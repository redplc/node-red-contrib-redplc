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

	const CS_R  = 0;
	const CS_LD = 1;
	const CS_CU = 2;
	const CS_CD = 3;
	const CS_QU = 10;
	const CS_QD = 11;
	
	const MAX_CV = 999999999;
	const MIN_CV = 0;

	RED.nodes.registerType("counter", function (n) {
		var node = this;
		RED.nodes.createNode(node, n);

		node.tagname = "C" + n.address;
		node.store = node.context().global;
		
		if (typeof node.store.keys().find(key => key == node.tagname) !== "undefined")
			node.iserror = syslib.outError(node, "duplicate: " + node.tagname, "duplicate address: " + node.tagname);
		else {
			node.operation = n.operation;
			node.overflow = n.overflow;
			node.pvs = parseInt(n.preset);
			node.pv = node.pvs;
			node.cs = 0;
			node.cv = (node.operation === "ctd") ? node.pv : 0;
			
			node.tagname_cv = node.tagname + ".cv";
			node.tagname_cs = node.tagname + ".cs";
			node.tagname_pv = node.tagname + ".pv";
			node.name = n.name.trim() ? n.name.trim() : node.tagname;

			node.store.set(node.tagname_cv, node.cv);
			node.store.set(node.tagname_cs, node.cs);
			node.store.set(node.tagname_pv, node.pv);

			node.preval_in = false;
			node.preval_cd = false;
			node.iserror = false;

			syslib.setStatus(node, node.name);
		}
		
		node.on("input", function (msg) {
			var val_in = syslib.getPayloadBool(node, msg);

			if (val_in === undefined)
				return;

			node.cs = node.store.get(node.tagname_cs);
			node.pv = node.store.get(node.tagname_pv);

			if (node.pv <= 0) {
				node.pv = node.pvs;
				node.store.set(node.tagname_pv, node.pv);
			}

			var cdir = 0;
			var pedge_in = (val_in && !node.preval_in);
			node.preval_in = val_in;

			var cs_r = syslib.getBit(node.cs, CS_R);
			var cs_ld = syslib.getBit(node.cs, CS_LD);
			var cs_cd = syslib.getBit(node.cs, CS_CD);
			var pedge_cd = (cs_cd && !node.preval_cd);
			node.preval_cd = cs_cd;

			var cs_cu = false;
			
			switch (node.operation) {
				case "ctu":
					if (cs_r)
						node.cv = 0;
					else {
						cs_cu = val_in;
						if (pedge_in)
							cdir = 1;
					}
					break;
				case "ctd":
					if (cs_ld)
						node.cv = node.pv;
					else {
						cs_cd = val_in;
						if (pedge_in)
							cdir = 2;
					}
					break;
				case "ctud":
					if (cs_r)
						node.cv = 0;
					else if (cs_ld)
						node.cv = node.pv;
					else {
						cs_cu = val_in;
						if (pedge_in)
							cdir = 1;
						else if (pedge_cd)
							cdir = 2;
					}
					break;
			}

			switch (cdir) {
				case 1:
					if (node.cv <= MAX_CV)
						if (node.overflow || (node.cv < node.pv))
							node.cv++;
					break;
				case 2:
					if (node.cv > MIN_CV)
						node.cv--;
					break;
			}

			var cs_qu = (node.cv >= node.pv);
			var cs_qd = (node.cv <= MIN_CV);

			node.cs = syslib.setBit(node.cs, CS_CU, cs_cu);
			node.cs = syslib.setBit(node.cs, CS_CD, cs_cd);
			node.cs = syslib.setBit(node.cs, CS_QU, cs_qu);
			node.cs = syslib.setBit(node.cs, CS_QD, cs_qd);

			node.store.set(node.tagname_cs, node.cs);
			node.store.set(node.tagname_cv, node.cv);

			switch (node.operation) {
				case "ctu":
					msg.payload = cs_qu;
					syslib.setStatusBoolValue(node, cs_qu, node.name + ": " + node.cv);
					break;
				case "ctd":
					msg.payload = cs_qd;
					syslib.setStatusBoolValue(node, cs_qd, node.name + ": " + node.cv);
					break;
				case "ctud":
					msg.payload = cs_qd || cs_qu;
					syslib.setStatusBoolValue(node, cs_qu || cs_qd, node.name + ": " + node.cv);
			}

			node.send(msg);
		});

		node.on('close', function () {
			node.store.set(node.tagname, undefined);
		});
	});
}
