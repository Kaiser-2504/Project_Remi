"""Tinh chỉnh (LoRA) một model nhỏ để đổi câu nói tiếng Việt thành JSON.

CHƯA CHẠY THỬ trong môi trường phát triển (không có GPU và mạng). Đọc kỹ và chạy thử với tập nhỏ trước.

  pip install torch transformers peft
  python ml/train/lora_finetune.py --base <model-nho-co-giay-phep-phu-hop> --train ml/data/train.jsonl

Chỉ tính loss trên phần JSON (completion), không tính trên prompt.
"""
import argparse
import json

import torch
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, Trainer, TrainingArguments

ap = argparse.ArgumentParser()
ap.add_argument("--base", required=True, help="tên hoặc đường dẫn model nền")
ap.add_argument("--train", default="ml/data/train.jsonl")
ap.add_argument("--out", default="ml/out/remi-lora")
ap.add_argument("--epochs", type=float, default=3)
ap.add_argument("--lr", type=float, default=2e-4)
ap.add_argument("--max_len", type=int, default=640)
args = ap.parse_args()

tok = AutoTokenizer.from_pretrained(args.base)
if tok.pad_token is None:
    tok.pad_token = tok.eos_token

use_cuda = torch.cuda.is_available()
model = AutoModelForCausalLM.from_pretrained(args.base, torch_dtype=torch.bfloat16 if use_cuda else torch.float32)
model = get_peft_model(
    model,
    LoraConfig(
        r=16, lora_alpha=32, lora_dropout=0.05, task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    ),
)


class Rows(Dataset):
    def __init__(self, path):
        with open(path, encoding="utf-8") as f:
            self.rows = [json.loads(line) for line in f if line.strip()]

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, i):
        r = self.rows[i]
        prompt = tok(r["prompt"], add_special_tokens=True)["input_ids"]
        comp = tok(r["completion"], add_special_tokens=False)["input_ids"] + [tok.eos_token_id]
        ids = (prompt + comp)[: args.max_len]
        labels = ([-100] * len(prompt) + comp)[: args.max_len]
        return {"input_ids": ids, "labels": labels}


def collate(batch):
    m = max(len(x["input_ids"]) for x in batch)
    ids = torch.full((len(batch), m), tok.pad_token_id, dtype=torch.long)
    lab = torch.full((len(batch), m), -100, dtype=torch.long)
    att = torch.zeros((len(batch), m), dtype=torch.long)
    for i, x in enumerate(batch):
        n = len(x["input_ids"])
        ids[i, :n] = torch.tensor(x["input_ids"])
        lab[i, :n] = torch.tensor(x["labels"])
        att[i, :n] = 1
    return {"input_ids": ids, "labels": lab, "attention_mask": att}


train_args = TrainingArguments(
    output_dir=args.out, num_train_epochs=args.epochs, per_device_train_batch_size=8,
    gradient_accumulation_steps=2, learning_rate=args.lr, lr_scheduler_type="cosine",
    warmup_ratio=0.03, logging_steps=20, save_strategy="epoch", bf16=use_cuda,
    report_to=[], remove_unused_columns=False,
)
Trainer(model=model, args=train_args, train_dataset=Rows(args.train), data_collator=collate).train()
model.save_pretrained(args.out)
print("Đã lưu bộ LoRA tại", args.out)
