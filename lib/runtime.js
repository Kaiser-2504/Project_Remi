'use strict';
/** Nối các phần lại với nhau cho môi trường chạy thật (Vercel). Chỉ nạp khi có yêu cầu đầu tiên. */
const { loadConfig } = require('./config');
const repo = require('./repo');
const { createPush } = require('./push');
const { createApi } = require('./api');
const { monitor } = require('./monitor');

const cfg = loadConfig(process.env);
const push = createPush({ repo, cfg });
const api = createApi({ repo, cfg, push, log: monitor.logger });

module.exports = { cfg, repo, push, api, log: monitor.logger };
