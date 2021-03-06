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

	const CS_R = 0;
	const CS_LD = 1;
	const CS_CU = 2;
	const CS_CD = 3;
	const CS_QU = 10;
	const CS_QD = 11;

	const TS_R  = 0;
	const TS_TT = 1;
	const TS_IN = 2;
	const TS_Q  = 10;

	const FF_R = 0;
	const FF_S = 1;
	const FF_Q = 10;
    
	RED.nodes.registerType("contact", function(n) {
		var node = this;
        RED.nodes.createNode(node, n);

		node.operand = n.operand;
		node.operation = n.operation;
		node.tagname = n.operand + n.address;
		node.name = node.tagname;

		node.prevVal = false;
		node.store = node.context().global;

		switch (n.operand) {
			default:
				node.bit = n.bit;
				node.name += "." + n.bit;
				break;
			case "C":
				switch (n.counter) {
					case "QU": node.bit = CS_QU; break;
					case "QD": node.bit = CS_QD; break;
					case "R":  node.bit = CS_R; break;
					case "LD": node.bit = CS_LD; break;
					case "CU": node.bit = CS_CU; break;
					case "CD": node.bit = CS_CD; break;
				}

				node.name += "." + n.counter;
				node.tagname += ".cs";
				break;
			case "T":
				switch (n.timer) {
					case "Q":  node.bit = TS_Q; break;
					case "TT": node.bit = TS_TT; break;
					case "R":  node.bit = TS_R; break;
					case "IN": node.bit = TS_IN; break;
				}

				node.name += "." + n.timer;
				node.tagname += ".ts";
				break;
			case "FF":
				switch (n.flipflop) {
					case "R": node.bit = FF_R; break;
					case "S": node.bit = FF_S; break;
					case "Q": node.bit = FF_Q; break;
				}

				node.name += "." + n.flipflop;
				node.tagname += ".ffs";
				break;
		}

		if (n.name.trim())
			node.outname = n.name.trim();
		else
			node.outname = node.name;
				
		syslib.setStatus(node, node.outname);

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			var val_read = syslib.getVariable(node, node.operand, node.tagname);
			
			if (val_read === undefined) {
				msg.payload = false;
				node.send(msg);
				return;
			}

			val_read = syslib.getBit(val_read, node.bit);

			var val_out; 
				
			switch (node.operation) {
				case "read":
					val_out = val_read;
					break;
				case "not":
					val_out = !val_read;
					break;
				case "pos":
					val_out = (val_read && !node.prevVal);
					break;
				case "neg":
					val_out = (!val_read && node.prevVal);
					break;
			}

			node.prevVal = val_read;
			msg.payload = val_out ? val_in : false;

			syslib.setStatusBool(node, msg.payload, val_out, node.outname);
			node.send(msg);
        });
	});

	RED.nodes.registerType("coil", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.operation = n.operation;
		node.operand = n.operand;
		node.tagname = n.operand + n.address;
		node.name = node.tagname;

		node.prevVal = false;
		node.mset = false;
		node.store = node.context().global;

		switch (n.operand) {
			case "M":
				if (typeof node.store.keys().find(key => key === node.tagname) === "undefined") {
					node.mset = true;
					node.store.set(node.tagname, 0);
				}
			default:
				node.bit = n.bit;
				node.name += "." + n.bit;
				break;
			case "C":
				switch (n.counter) {
					case "R":  node.bit = CS_R; break;
					case "LD": node.bit = CS_LD; break;
					case "CD": node.bit = CS_CD; break;
				}
				node.tagname += ".cs";
				node.name += "." + n.counter;
				break;
			case "T":
				node.bit = TS_R;
				node.tagname += ".ts";
				node.name += ".R";
				break;
			case "FF":
				switch (n.flipflop) {
					case "R": node.bit = FF_R; break;
					case "S": node.bit = FF_S; break;
				}
				node.name += "." + n.flipflop;
				node.tagname += ".ffs";
				break;
		}

		if (n.name.trim())
			node.outname = n.name.trim();
		else
			node.outname = node.name;

		syslib.setStatus(node, node.outname);

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			var val_read = syslib.getVariable(node, node.operand, node.tagname);

			if (val_read === undefined) {
				msg.payload = false;
				node.send(msg);
				return;
			}

			var val_out = undefined;

			switch (node.operation) {
				case "store":
					val_out = val_in;
					break;
				case "not":
					val_out = !val_in;
					break;
				case "set":
					if (val_in)
						val_out = true;
					break;
				case "res":
					if (val_in)
						val_out = false;
					break;
				case "pos":
					if (val_in && !node.prevVal)
						val_out = true;
					break;
				case "neg":
					if (!val_in && node.prevVal)
						val_out = true;
					break;
			}

			node.prevVal = val_in;
			
			if (val_out !== undefined)
				node.store.set(node.tagname, syslib.setBit(val_read, node.bit, val_out));

			val_read = syslib.getBit(node.store.get(node.tagname), node.bit);

			syslib.setStatusBool(node, val_read, false, node.outname);

			msg.payload = val_in;
			node.send(msg);
		});

		node.on('close', function () {
			if (node.mset)
				node.store.set(node.tagname, undefined);
		});
	});

	RED.nodes.registerType("digital-function", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.operation = n.operation;
		node.name = n.operation;
		node.prevVal = false;

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg, node.operation);

			if (val_in === undefined)
				return;

			switch (node.operation) {
				case "not":
					msg.payload = !val_in;
					break;
				case "nop":
				case "or":
				case "and":
				case "xor":
					msg.payload = val_in;
					break;
				case "pos":
					msg.payload = (val_in && !node.prevVal);
					break;
				case "neg":
					msg.payload = (!val_in && node.prevVal);
					break;
			}

			node.prevVal = val_in;
			syslib.setStatusBool(node, msg.payload, false);
			node.send(msg);
		});
	});

	RED.nodes.registerType("flipflop", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.tagname = "FF" + n.address;
		node.name = node.tagname;
		node.store = node.context().global;

		if (typeof node.store.keys().find(key => key == node.tagname) !== "undefined")
			node.iserror = syslib.outError(node, "duplicate: " + node.tagname, "duplicate address: " + node.tagname);
		else {
			node.operation = n.operation;
			node.fs = 0;
			node.fs_q = false;
			node.tagname_fs = node.tagname + ".ffs";
			node.store.set(node.tagname_fs, node.fs);
			node.iserror = false;

			if (n.name.trim())
				node.outname = n.name.trim();
			else
				node.outname = node.name;

			syslib.setStatus(node, node.outname);
		}

		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			node.fs = node.store.get(node.tagname_fs);

			var fs_r = syslib.getBit(node.fs, FF_R);
			var fs_s = syslib.getBit(node.fs, FF_S);

			switch (node.operation) {
				case "rs":
					fs_r = val_in;
					if (fs_r)
						node.fs_q = false;
					else if (fs_s)
						node.fs_q = true;
					break;

				case "sr":
					fs_s = val_in;
					if (fs_s) 
						node.fs_q = true;
					else if (fs_r)
						node.fs_q = false;
			}

			node.fs = syslib.setBit(node.fs, FF_S, fs_s);
			node.fs = syslib.setBit(node.fs, FF_R, fs_r);
			node.fs = syslib.setBit(node.fs, FF_Q, node.fs_q);
			node.store.set(node.tagname_fs, node.fs);

			syslib.setStatusBool(node, node.fs_q, false, node.outname);

			msg.payload = node.fs_q;
			node.send(msg);
		});

		node.on('close', function () {
			node.store.set(node.tagname, undefined);
		});
	});
}
