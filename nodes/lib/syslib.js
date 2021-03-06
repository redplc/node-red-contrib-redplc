/**
 * Copyright 2021 Ocean (iot.redplc@gmail.com).
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use node file except in compliance with the License.
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

/**
 * Outputs error on status and error log.
 */
function outError(node, errShort, errLong) {
	if (node.save_txt === errShort)
		return true;

	node.save_txt = errShort;
	node.status({fill: "red", shape: "ring", text: errShort});
	node.error(errLong);

	return true;
}
module.exports.outError = outError;

/**
 * Sets node status.
 */
module.exports.setStatus = function(node, txt = "") {
	if (node.save_txt === txt)
		return;

	node.save_txt = txt;
	node.status({text: txt});
}

/**
 * Sets node bool status.
 */
module.exports.setStatusBool = function (node, val, state, txt = "") {
	if ((node.save_txt === val) && (node.save_state === state))
		return;

	node.save_txt = val;
	node.save_state = state;

	node.status({ fill: val ? "green" : "yellow", shape: state || val ? "dot" : "ring", text: txt });
}

/**
 * Sets node bool and value status.
 */
module.exports.setStatusBoolValue = function (node, val, txt = "") {
		if ((node.save_val === val) && (node.save_txt === txt))
			return;

		node.save_val = val;
		node.save_txt = txt;

		node.status({ fill: val ? "green" : "yellow", shape: val ? "dot" : "ring", text: txt });
}

/**
 * Convert milisecond in day, hour, minute, second, milisecond.
 */
module.exports.printTimeVal = function (value, full) {
	const DIV_D = 24 * 60 * 60 * 1000;
	const DIV_H = 60 * 60 * 1000;
	const DIV_M = 60 * 1000;
	const DIV_S = 1000;

	if (value < 0)
		value = Math.abs(value);

	if (value === 0)
		return "0";
	
	var days = Math.trunc(value / DIV_D);
	var rem = value % DIV_D;

	var hours = Math.trunc(rem / DIV_H);
	rem = rem % DIV_H;

	var minutes = Math.trunc(rem / DIV_M);
	rem = rem % DIV_M;

	var seconds = Math.trunc(rem / DIV_S);
	var miliseconds = rem % DIV_S;

	var outstring = "";

	if (days > 0)
		outstring += days + "d";

	if (hours > 0)
		outstring += hours + "h";

	if (minutes > 0)
		outstring += minutes + "m";

	if (seconds > 0)
		if (full || (value < DIV_D))
			outstring += seconds + "s";
	
	if (miliseconds > 0)
		if (full || (value < DIV_S))
			outstring += miliseconds + "ms";

	return outstring;
}

/**
 * Get bit from numeric.  Handling for bit 31
 */
module.exports.getBit = function (val, bit) {
	try {
		if (val < 0)
			val = Math.abs(val);

		var bit31 = val >= 0x80000000;

		if (bit == 31)
			return bit31;

		if (bit31)
			val = val - 0x80000000;

		var ret = (val & (1 << bit)) > 0;

		if (bit31)
			val = val + 0x80000000;
		
		return ret;
	}
	catch (e) { }
	return false;
}

/**
 * Set bit in numeric. Handling for bit 31
 */
module.exports.setBit = function (val, bit, valbit) {
	try {
		if (val < 0)
			val = Math.abs(val);

		var bit31 = val >= 0x80000000;

		if (bit == 31) {
			if (valbit)
				return bit31 ? val : val + 0x80000000;
			else
				return bit31 ? val - 0x80000000 : val;
		}

		if (bit31)
			val = val - 0x80000000;

		if (valbit)
			val |= (1 << bit);
		else
			val &= ~(1 << bit);

		if (bit31)
			val = val + 0x80000000;

		return val;
	}
	catch (e) { }
	return 0;
}

/**
 * Check variable
 */
function checkVariable(node, operand, name, index, checkvalue) {
	var idx = name.indexOf(".");
	if (idx > 0)
		name = name.substring(0, idx);
		
	switch (operand) {
		case "I":
		case "Q":
		case "M":
		case "C":
		case "T":
		case "FF":
		case "MA":
			if (typeof checkvalue !== "number") {
				outError(node, "var " + name, "invalid variable " + name);
				return;
			}

			return checkvalue;

		case "IA":
		case "QA":
			if (!Array.isArray(checkvalue)) {
				outError(node, "var " + name, "invalid variable " + name);
				return;
			}

			if (index >= checkvalue.length) {
				outError(node, "index " + index, "invalid index " + index);
				return;
			}

			if (typeof checkvalue[index] !== "number") {
				outError(node, "type " + name, "invalid type " + name);
				return;
			}

			return checkvalue[index];

		case "MS":
			if (typeof checkvalue !== "string") {
				outError(node, "var " + name, "invalid variable " + name);
				return;
			}

			return checkvalue;

		case "IS":
		case "QS":
			if (!Array.isArray(checkvalue)) {
				outError(node, "var " + name, "invalid variable " + name);
				return;
			}

			if (index >= checkvalue.length) {
				outError(node, "index " + index, "invalid index " + index);
				return;
			}

			if (typeof checkvalue[index] !== "string") {
				outError(node, "type " + name, "invalid type " + name);
				return;
			}

			return checkvalue[index];
	}
}

module.exports.checkVariable = checkVariable;

/**
 * Get Global Variable
 */
module.exports.getVariable = function (node, operand, tagname, index) {
	return checkVariable(node, operand, tagname, index, node.store.get(tagname));
}

/**
 * Set Global Variable
 */
module.exports.setVariable = function (node, operand, tagname, index, setvalue) {

	var valset = node.store.get(tagname);

	if (checkVariable(node, operand, tagname, index, valset) !== undefined) {
		if (Array.isArray(valset))
			valset[index] = setvalue;
		else
			valset = setvalue;
		node.store.set(tagname, valset);
		return true;
	}

	return false;
}

/**
 * Scan for multiple inputs and performs logical operation.
 */
module.exports.getPayloadBool = function (node, msg, instruction = "or") {
	try {
		if (node.iserror === true)
			return;

		if (typeof msg.payload !== "boolean") {
			node.iserror = outError(node, "not bool", "payload is not boolean");
			return;
		}

		if (msg.hasOwnProperty("init")) {
			if (!node.hasOwnProperty("save_rung_num"))
				node.save_rung_num = msg.init;
			else if (node.save_rung_num !== msg.init) {
				node.iserror = outError(node, "cross wire", "cross wire between rungs");
				return;
			}
		}

		if (!node.hasOwnProperty("save_input_sum"))
			node.save_input_sum = 1;

		if (node.save_msgid !== msg._msgid) {
			node.save_msgid = msg._msgid;
			node.save_input_cnt = 1;
			if (instruction === "xor") {
				node.save_payload = false;
				node.save_xor = msg.payload;
			}
			else
				node.save_payload = msg.payload;
		}
		else {
			switch (instruction) {
				case "and":
					node.save_payload = node.save_payload && msg.payload;
					break;
				case "xor":
					if (node.save_xor !== msg.payload)
						node.save_payload = true;
					break;
				default:
					node.save_payload = node.save_payload || msg.payload;
			}

			node.save_input_cnt++;

			if (node.save_input_cnt > node.save_input_sum) {
				node.save_input_sum = node.save_input_cnt;
				return;
			}
		}

		if (node.save_input_cnt == node.save_input_sum)
			return node.save_payload;
	}
	catch (e) { }
}
