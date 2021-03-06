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

	const MUL_D = 24 * 60 * 60 * 1000;
	const MUL_H = 60 * 60 * 1000;
	const MUL_M = 60 * 1000;
	const MUL_S = 1000;
	const MUL_MS = 10;

	RED.nodes.registerType("compare", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.operation = n.operation;

		switch (n.operation) {
			case "hysHL":
			case "hysLH":
			case "inlimit":
			case "outlimit":
				node.isop2 = false;
				break;
			default:
				node.isop2 = true;
		}

		node.tagname1 = n.operand1 + n.address1;
		node.index1 = n.index1;
		node.operand1 = n.operand1;
		node.name = node.tagname1;

		switch (node.operand1) {
			case "C":
				node.tagname1 += ".cv";
				break;
			case "T":
				node.tagname1 += ".et";
				break;
			case "IA":
			case "QA":
				node.name += "[" + node.index1 + "]";
				break;
		}

		if (node.isop2) {
			node.tagname2 = n.operand2 + n.address2;
			node.index2 = n.index2;
			node.operand2 = n.operand2;

			switch (node.operand2) {
				case "nconst":
					node.const2 = Number(n.const2);
					break;
				case "tconst":
					node.const2 = parseInt(n.tms2) * MUL_MS;
					node.const2 += (parseInt(n.ts2) * MUL_S);
					node.const2 += (parseInt(n.tm2) * MUL_M);
					node.const2 += (parseInt(n.th2) * MUL_H);
					node.const2 += (parseInt(n.td2) * MUL_D);
					break;
				case "C":
					node.tagname2 += ".cv";
					break;
				case "T":
					node.tagname2 += ".et";
					break;
			}
		}
		else {
			node.operandl = n.operandl;
			switch (node.operandl) {
				case "nconst":
					node.constl = Number(n.constl);
					break;
				case "tconst":
					node.constl = parseInt(n.tmsl) * MUL_MS;
					node.constl += (parseInt(n.tsl) * MUL_S);
					node.constl += (parseInt(n.tml) * MUL_M);
					node.constl += (parseInt(n.thl) * MUL_H);
					node.constl += (parseInt(n.tdl) * MUL_D);
					break;
				default:
					node.tagnamel = n.operandl + n.addressl;
			}

			node.operandh = n.operandh;
			switch (node.operandh) {
				case "nconst":
					node.consth = Number(n.consth);
					break;
				case "tconst":
					node.consth = parseInt(n.tmsh) * MUL_MS;
					node.consth += (parseInt(n.tsh) * MUL_S);
					node.consth += (parseInt(n.tmh) * MUL_M);
					node.consth += (parseInt(n.thh) * MUL_H);
					node.consth += (parseInt(n.tdh) * MUL_D);
					break;
				default:
					node.tagnameh = n.operandh + n.addressh;
			}
		}

		if (n.name.trim())
			node.outname = n.name.trim();
		else
			node.outname = node.name;

		node.store = node.context().global;

		syslib.setStatus(node, node.outname);

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			msg.payload = false;

			var val_read1 = syslib.getVariable(node, node.operand1, node.tagname1, node.index1);

			if (val_read1 === undefined) {
				node.send(msg);
				return;
			}

			var val_read2;
			var val_readl;
			var val_readh;

			if (node.isop2) {
				switch (node.operand2) {
					case "nconst":
					case "tconst":
						val_read2 = node.const2;
						break;
					default:
						val_read2 = syslib.getVariable(node, node.operand2, node.tagname2, node.index2);

						if (val_read2 === undefined) {
							node.send(msg);
							return;
						}
				}
			}
			else {
				switch (node.operandl) {
					case "nconst":
					case "tconst":
						val_readl = node.constl;
						break;
					default:
						val_readl = syslib.getVariable(node, node.operandl, node.tagnamel);

						if (val_readl === undefined) {
							node.send(msg);
							return;
						}
				}

				switch (node.operandh) {
					case "nconst":
					case "tconst":
						val_readh = node.consth;
						break;
					default:
						val_readh = syslib.getVariable(node, node.operandh, node.tagnameh);

						if (val_readh === undefined) {
							node.send(msg);
							return;
						}
				}

				if (val_readl >= val_readh) {
					syslib.outError(node, "limit L>=H", "invalid limit L>=H");
					node.send(msg);
					return;
				}
			}
				
			switch (node.operation) {
				case "eq":
					node.val_out = (val_read1 == val_read2);
					break;
				case "ne":
					node.val_out = (val_read1 != val_read2);
					break;
				case "lt":
					node.val_out = (val_read1 < val_read2);
					break;
				case "gt":
					node.val_out = (val_read1 > val_read2);
					break;
				case "le":
					node.val_out = (val_read1 <= val_read2);
					break;
				case "ge":
					node.val_out = (val_read1 >= val_read2);
					break;
				case "hysHL":
					if ((node.val_out) && (val_read1 >= val_readh))
						node.val_out = false;
					else if ((!node.val_out) && (val_read1 <= val_readl))
						node.val_out = true;
					break;
				case "hysLH":
					if ((node.val_out) && (val_read1 <= val_readl))
						node.val_out = false;
					else if ((!node.val_out) && (val_read1 >= val_readh))
						node.val_out = true;
					break;
				case "inlimit":
					node.val_out = (val_read1 >= val_readl) && (val_read1 <= val_readh);
					break;
				case "outlimit":
					node.val_out = (val_read1 < val_readl) || (val_read1 > val_readh);
					break;
			}

			msg.payload = (node.val_out) ? val_in : false;

			syslib.setStatusBool(node, msg.payload, node.val_out, node.outname);
			node.send(msg);
		});
	});
}
