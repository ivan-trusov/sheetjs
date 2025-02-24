function decode_row(rowstr/*:string*/)/*:number*/ { return parseInt(unfix_row(rowstr),10) - 1; }
function encode_row(row/*:number*/)/*:string*/ { return "" + (row + 1); }
function fix_row(cstr/*:string*/)/*:string*/ { return cstr.replace(/([A-Z]|^)(\d+)$/,"$1$$$2"); }
function unfix_row(cstr/*:string*/)/*:string*/ { return cstr.replace(/\$(\d+)$/,"$1"); }

function decode_col(colstr/*:string*/)/*:number*/ { var c = unfix_col(colstr), d = 0, i = 0; for(; i !== c.length; ++i) d = 26*d + c.charCodeAt(i) - 64; return d - 1; }
function encode_col(col/*:number*/)/*:string*/ { if(col < 0) throw new Error("invalid column " + col); var s=""; for(++col; col; col=Math.floor((col-1)/26)) s = String.fromCharCode(((col-1)%26) + 65) + s; return s; }
function fix_col(cstr/*:string*/)/*:string*/ { return cstr.replace(/^([A-Z])/,"$$$1"); }
function unfix_col(cstr/*:string*/)/*:string*/ { return cstr.replace(/^\$([A-Z])/,"$1"); }

function split_cell(cstr/*:string*/)/*:Array<string>*/ { return cstr.replace(/(\$?[A-Z]*)(\$?\d*)/,"$1,$2").split(","); }
//function decode_cell(cstr/*:string*/)/*:CellAddress*/ { var splt = split_cell(cstr); return { c:decode_col(splt[0]), r:decode_row(splt[1]) }; }
function decode_cell(cstr/*:string*/)/*:CellAddress*/ {
	var R = 0, C = 0;
	for(var i = 0; i < cstr.length; ++i) {
		var cc = cstr.charCodeAt(i);
		if(cc >= 48 && cc <= 57) R = 10 * R + (cc - 48);
		else if(cc >= 65 && cc <= 90) C = 26 * C + (cc - 64);
	}
	return { c: C - 1, r:R - 1 };
}
//function encode_cell(cell/*:CellAddress*/)/*:string*/ { return encode_col(cell.c) + encode_row(cell.r); }
function encode_cell(cell/*:CellAddress*/)/*:string*/ {
	var col = cell.c + 1;
	var s="";
	for(; col; col=((col-1)/26)|0) s = String.fromCharCode(((col-1)%26) + 65) + s;
	return s + (cell.r + 1);
}
function decode_range(range/*:string*/)/*:Range*/ {
	var idx = range.indexOf(":");
	if(idx == -1) return { s: decode_cell(range), e: decode_cell(range) };
	return { s: decode_cell(range.slice(0, idx)), e: decode_cell(range.slice(idx + 1)) };
}
/*# if only one arg, it is assumed to be a Range.  If 2 args, both are cell addresses */
function encode_range(cs/*:CellAddrSpec|Range*/,ce/*:?CellAddrSpec*/)/*:string*/ {
	if(typeof ce === 'undefined' || typeof ce === 'number') {
/*:: if(!(cs instanceof Range)) throw "unreachable"; */
		return encode_range(cs.s, cs.e);
	}
/*:: if((cs instanceof Range)) throw "unreachable"; */
	if(typeof cs !== 'string') cs = encode_cell((cs/*:any*/));
	if(typeof ce !== 'string') ce = encode_cell((ce/*:any*/));
/*:: if(typeof cs !== 'string') throw "unreachable"; */
/*:: if(typeof ce !== 'string') throw "unreachable"; */
	return cs == ce ? cs : cs + ":" + ce;
}
function fix_range(a1/*:string*/)/*:string*/ {
	var s = decode_range(a1);
	return "$" + encode_col(s.s.c) + "$" + encode_row(s.s.r) + ":$" + encode_col(s.e.c) + "$" + encode_row(s.e.r);
}

// List of invalid characters needs to be tested further
function formula_quote_sheet_name(sname/*:string*/, opts)/*:string*/ {
	if(!sname && !(opts && opts.biff <= 5 && opts.biff >= 2)) throw new Error("empty sheet name");
	if (/[^\w\u4E00-\u9FFF\u3040-\u30FF]/.test(sname)) return "'" + sname.replace(/'/g, "''") + "'";
	return sname;
}

function safe_decode_range(range/*:string*/)/*:Range*/ {
	var o = {s:{c:0,r:0},e:{c:0,r:0}};
	var idx = 0, i = 0, cc = 0;
	var len = range.length;
	for(idx = 0; i < len; ++i) {
		if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
		idx = 26*idx + cc;
	}
	o.s.c = --idx;

	for(idx = 0; i < len; ++i) {
		if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
		idx = 10*idx + cc;
	}
	o.s.r = --idx;

	if(i === len || cc != 10) { o.e.c=o.s.c; o.e.r=o.s.r; return o; }
	++i;

	for(idx = 0; i != len; ++i) {
		if((cc=range.charCodeAt(i)-64) < 1 || cc > 26) break;
		idx = 26*idx + cc;
	}
	o.e.c = --idx;

	for(idx = 0; i != len; ++i) {
		if((cc=range.charCodeAt(i)-48) < 0 || cc > 9) break;
		idx = 10*idx + cc;
	}
	o.e.r = --idx;
	return o;
}

function safe_format_cell(cell/*:Cell*/, v/*:any*/) {
	var q = (cell.t == 'd' && v instanceof Date);
	if(cell.z != null) try { return (cell.w = SSF_format(cell.z, q ? datenum(v) : v)); } catch(e) { }
	try { return (cell.w = SSF_format((cell.XF||{}).numFmtId||(q ? 14 : 0),  q ? datenum(v) : v)); } catch(e) { return ''+v; }
}

function format_cell(cell/*:Cell*/, v/*:any*/, o/*:any*/) {
	if(cell == null || cell.t == null || cell.t == 'z') return "";
	if(cell.w !== undefined) return cell.w;
	if(cell.t == 'd' && !cell.z && o && o.dateNF) cell.z = o.dateNF;
	if(cell.t == "e") return BErr[cell.v] || cell.v;
	if(v == undefined) return safe_format_cell(cell, cell.v);
	return safe_format_cell(cell, v);
}

function sheet_to_workbook(sheet/*:Worksheet*/, opts)/*:Workbook*/ {
	var n = opts && opts.sheet ? opts.sheet : "Sheet1";
	var sheets = {}; sheets[n] = sheet;
	return { SheetNames: [n], Sheets: sheets };
}

function sheet_add_aoa(_ws/*:?Worksheet*/, data/*:AOA*/, opts/*:?any*/)/*:Worksheet*/ {
	var o = opts || {};
	var dense = _ws ? Array.isArray(_ws) : o.dense;
	if(DENSE != null && dense == null) dense = DENSE;
	var ws/*:Worksheet*/ = _ws || (dense ? ([]/*:any*/) : ({}/*:any*/));
	var _R = 0, _C = 0;
	if(ws && o.origin != null) {
		if(typeof o.origin == 'number') _R = o.origin;
		else {
			var _origin/*:CellAddress*/ = typeof o.origin == "string" ? decode_cell(o.origin) : o.origin;
			_R = _origin.r; _C = _origin.c;
		}
		if(!ws["!ref"]) ws["!ref"] = "A1:A1";
	}
	var range/*:Range*/ = ({s: {c:10000000, r:10000000}, e: {c:0, r:0}}/*:any*/);
	if(ws['!ref']) {
		var _range = safe_decode_range(ws['!ref']);
		range.s.c = _range.s.c;
		range.s.r = _range.s.r;
		range.e.c = Math.max(range.e.c, _range.e.c);
		range.e.r = Math.max(range.e.r, _range.e.r);
		if(_R == -1) range.e.r = _R = _range.e.r + 1;
	}
	for(var R = 0; R != data.length; ++R) {
		if(!data[R]) continue;
		if(!Array.isArray(data[R])) throw new Error("aoa_to_sheet expects an array of arrays");
		for(var C = 0; C != data[R].length; ++C) {
			if(typeof data[R][C] === 'undefined') continue;
			var cell/*:Cell*/ = ({v: data[R][C] }/*:any*/);
			var __R = _R + R, __C = _C + C;
			if(range.s.r > __R) range.s.r = __R;
			if(range.s.c > __C) range.s.c = __C;
			if(range.e.r < __R) range.e.r = __R;
			if(range.e.c < __C) range.e.c = __C;
			if(data[R][C] && typeof data[R][C] === 'object' && !Array.isArray(data[R][C]) && !(data[R][C] instanceof Date)) cell = data[R][C];
			else {
				if(Array.isArray(cell.v)) { cell.f = data[R][C][1]; cell.v = cell.v[0]; }
				if(cell.v === null) {
					if(cell.f) cell.t = 'n';
					else if(o.nullError) { cell.t = 'e'; cell.v = 0; }
					else if(!o.sheetStubs) continue;
					else cell.t = 'z';
				}
				else if(typeof cell.v === 'number') cell.t = 'n';
				else if(typeof cell.v === 'boolean') cell.t = 'b';
				else if(cell.v instanceof Date) {
					cell.z = o.dateNF || table_fmt[14];
					if(o.cellDates) { cell.t = 'd'; cell.w = SSF_format(cell.z, datenum(cell.v)); }
					else { cell.t = 'n'; cell.v = datenum(cell.v); cell.w = SSF_format(cell.z, cell.v); }
				}
				else cell.t = 's';
			}
			if(dense) {
				if(!ws[__R]) ws[__R] = [];
				if(ws[__R][__C] && ws[__R][__C].z) cell.z = ws[__R][__C].z;
				ws[__R][__C] = cell;
			} else {
				var cell_ref = encode_cell(({c:__C,r:__R}/*:any*/));
				if(ws[cell_ref] && ws[cell_ref].z) cell.z = ws[cell_ref].z;
				ws[cell_ref] = cell;
			}
		}
	}
	if(range.s.c < 10000000) ws['!ref'] = encode_range(range);
	return ws;
}
function aoa_to_sheet(data/*:AOA*/, opts/*:?any*/)/*:Worksheet*/ { return sheet_add_aoa(null, data, opts); }

