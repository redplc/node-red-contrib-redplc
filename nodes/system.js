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
	RED.nodes.registerType("redplc-cpu", function(n) {
		var node = this;
		RED.nodes.createNode(node, n);
		
        node.outputs = n.outputs;
		node.sdelay = n.sdelay;
		node.tinput = n.tinput;
		node.toutput = n.toutput;
		node.trungs = n.trungs;

		node.stime = n.stime;
		node.stm = true;
		node.tc = 0;
		node.tupd = new Date();
		node.outbuf = [node.outputs];

		const OUT_INPUT  = 0;
		const OUT_OUTPUT = 1;
		const OUT_RUNGS  = 2;

		node.outstate = OUT_INPUT;
		node.outindex = 1; 
		node.tosend = true;
		node.run = true;
		node.status({ fill: "green", text: "run" });

		function cpu_loop() {
			if (!node.run)
				return;

			if (!node.tosend)
				return;

			node.tosend = false;

			for (var i = 0; i < node.outputs; i++)
				node.outbuf[i] = null;

			switch (node.outstate) {
				case OUT_INPUT:
					node.sendtimeout = 0;
					if (node.wires[0].length > 0) {
						node.outbuf[0] = { payload: "input" };
						node.sendtimeout = node.tinput;
					}
					node.outindex = 1; 
					node.outstate = OUT_RUNGS;
					break;
				case OUT_OUTPUT:
					node.sendtimeout = 0;
					if (node.wires[0].length > 0) {
						node.outbuf[0] = { payload: "output" };
						node.sendtimeout = node.toutput;
					}
					node.outstate = OUT_INPUT;
					break;
				case OUT_RUNGS:
					node.sendtimeout = 0;
					if (node.wires[node.outindex].length > 0) {
						node.outbuf[node.outindex] = { payload: true };
						node.sendtimeout = node.trungs;
					}
					node.outindex++;
					if (node.outindex >= node.outputs) {
						node.outindex = 1;
						node.outstate = OUT_OUTPUT;

						if (node.stime) {
							if (node.stm)
								node.hrtime = process.hrtime();
							else {
								node.tc = (process.hrtime(node.hrtime)[1] / 1000000).toFixed(0);

								if ((new Date() - node.tupd) >= 1000) {
									node.tupd = new Date();
									if (node.run)
										node.status({ fill: "green", text: "run t=" + node.tc + "ms" });
								}
							}

							node.stm = !node.stm;
						}
					}
					break;
			}

			if (node.sendtimeout > 0) {
				node.send(node.outbuf);
				node.id_sendtimeout = setTimeout(function () {
					node.tosend = true;
				}, node.sendtimeout);
			}
			else
				node.tosend = true;
		}

		node.id_sdelay = setTimeout(function () {
			node.outbuf[0] = null;

			for (var i = 1; i < node.outputs; i++)
				node.outbuf[i] = { payload: false, init: i };

			node.send(node.outbuf);

			setTimeout(function () {
				node.id_loop = setInterval(cpu_loop, 0);
			}, 100);
		}, node.sdelay);

		node.on("input", function (msg) {
			if (typeof msg.payload !== "boolean")
				return;
			
			if (msg.payload && !node.run) {
				node.run = true;
				node.status({ fill: "green", text: "run" });
			}
			else if (!msg.payload && node.run) {
				node.run = false;
				node.status({fill: "red", text: "stop"});
			}
		});
			
		node.on('close', function () {
			clearTimeout(node.id_sendtimeout);
			clearInterval(node.id_loop);
			clearTimeout(node.id_sdelay);
        });
	});

	RED.nodes.registerType("sys-start", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.status({});

		node.on("input", function (msg) {
			if (!node.init) {
				if (msg.payload === true) {
					node.init = true;
					node.status({ fill: "green"});
				}
				node.send(msg);
			}
		});
	});

	RED.nodes.registerType("rung-start", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.init = false;
		node.comment = n.comment.trim();
		node.status({ text: node.comment });

		node.on("input", function (msg) {
			if (!node.init && msg.hasOwnProperty("init")) {
				node.init = true;
				if (!node.comment) {
					var txt = (msg.init < 10) ? "0" + msg.init : msg.init;
					node.status({ text: txt });
				}
			}

			node.send(msg);
		});
	});
}

