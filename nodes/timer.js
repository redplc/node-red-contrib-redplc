/**
 * Copyright 2021 Ocean (iot.redplc@gmail.com).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

"use strict";

module.exports = function (RED) {

	const syslib = require('./lib/syslib.js');

	const TS_R = 0;
	const TS_TT = 1;
	const TS_IN = 2;
	const TS_Q = 10;

	RED.nodes.registerType("timer", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.tagname = "T" + n.address;
		node.store = node.context().global;
		
		if (typeof node.store.keys().find(key => key == node.tagname) !== "undefined")
			node.iserror = syslib.outError(node, "duplicate: " + node.tagname, "duplicate address: " + node.tagname);
		else {
			node.operation = n.operation;

			node.pts = parseInt(n.tms) * 10;
			node.pts += (parseInt(n.ts) * 1000);
			node.pts += (parseInt(n.tm) * 60 * 1000);
			node.pts += (parseInt(n.th) * 60 * 60 * 1000);
			node.pts += (parseInt(n.td) * 24 * 60 * 60 * 1000);

			if (node.pts <= 0)
				node.pts = 1000;

			node.pt = node.pts;
			node.et = 0;
			node.ts = 0;

			node.iserror = false;
			node.preval = false;
			node.ts_tt = false;
			node.trun = false;
			node.toggle = false;

			node.tagname_et = node.tagname + ".et";
			node.tagname_ts = node.tagname + ".ts";
			node.tagname_pt = node.tagname + ".pt";
			node.name = n.name.trim() ? n.name.trim() : node.tagname;

			node.store.set(node.tagname_et, node.et);
			node.store.set(node.tagname_ts, node.ts);
			node.store.set(node.tagname_pt, node.pt);

			syslib.setStatus(node, node.name);
		}

		function startTimer() {
			node.et = 0;
			node.pt = node.store.get(node.tagname_pt);
			if (node.pt <= 0) {
				node.pt = node.pts;
				node.store.set(node.tagname_pt, node.pt);
			}
			node.trun = true;
			node.ts_tt = true;
			node.tstart = Date.now();
			node.t_id = setInterval(function () {
				if (!node.ts_tt)
					return;

				if (node.et >= node.pt) {
					clearInterval(node.t_id);
					node.ts_tt = false;
					node.et = node.pt;
				}
				else
					node.et = Date.now() - node.tstart;
			}, 2);
		}

		function stopTimer() {
			node.ts_tt = false;
			node.trun = false;
			clearInterval(node.t_id);
			node.et = 0;
		}

		function pauseTimer() {
			node.ts_tt = false;
		}

		function resumeTimer() {
			if (!node.trun)
				startTimer();
			else if (!node.ts_tt) {
				node.tstart = Date.now() - node.et;
				node.ts_tt = true;
			}
		}

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			var pedge = (val_in && !node.preval);
			var nedge = (!val_in && node.preval);
			node.preval = val_in;

			node.ts = node.store.get(node.tagname_ts);
			var ts_q = false;

			switch (node.operation) {
				case "ton":
					if (!val_in)
						stopTimer();
					else if (pedge)
						startTimer();

					ts_q = val_in && (node.et >= node.pt);
					break;

				case "tof":
					if (val_in)
						stopTimer();
					else if (nedge)
						startTimer();

					ts_q = val_in || node.ts_tt;
					break;

				case "tp":
					if (pedge && !node.ts_tt)
						startTimer();

					ts_q = node.ts_tt;
					break;

				case "tpi":
					if (!val_in) {
						stopTimer();
						node.toggle = false;
					}
					else if (pedge) {
						startTimer();
						node.toggle = true;
					}
					else if (node.et >= node.pt) {
						startTimer();
						node.toggle = !node.toggle;
					}

					ts_q = node.toggle;
					break;

				case "tonr":
					if (syslib.getBit(node.ts, TS_R))
						stopTimer();
					else if (pedge)
						resumeTimer();
					else if (!val_in)
						pauseTimer();

					ts_q = (node.et >= node.pt);
					break;
			}
			
			node.ts = syslib.setBit(node.ts, TS_IN, val_in);
			node.ts = syslib.setBit(node.ts, TS_TT, node.ts_tt);
			node.ts = syslib.setBit(node.ts, TS_Q, ts_q);

			node.store.set(node.tagname_ts, node.ts);
			node.store.set(node.tagname_et, node.et);

			if (node.operation === "tpi")
				syslib.setStatusBoolValue(node, ts_q, node.name);
			else
				syslib.setStatusBoolValue(node, ts_q, node.name + ": " + syslib.printTimeVal(node.et, !node.ts_tt));

			msg.payload = ts_q;
			node.send(msg);
		});

		node.on('close', function () {
			stopTimer();
			node.store.set(node.tagname, undefined);
		});
	});
}
