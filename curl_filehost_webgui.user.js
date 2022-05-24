// ==UserScript==
// @name curl_filehost_webgui
// @description Adds "bullshit" web GUI into file hostings intended to be used through curl.
// @author KOLANICH
// @version 0.1
// @license Unlicense
// @grant GM.xmlHttpRequest
// @include https://0x0.st/
// @include https://www.file.io/
// @include https://transfer.sh/
// @include https://files.reol.com/
// @include https://up10.me/
// @include https://transfer.nodl.it/
// @include https://transfer.whalebone.io/
// @include https://dl.digdeo.fr/
// ==/UserScript==

"use strict";

const transferShRx = /^Easy (?:and Secure )?file sharing from (?:the )?(?:shell terminal|command line)$/;
const sw = {
	"0x0.st": {
		"file": {
			"field": "file",
			"method": "POST",
		},
		"url": {
			"field": "url",
			"method": "POST",
		},
		"services": [
			"0x0.st",
		],
		"cspRestricted": true
	},
	"file.io": {
		"file": {
			"field": "file",
			"uri": (cur) => "https://file.io/?expires=1y", // ww.file.io is website, doesn't accept data from curl
			"method": "POST",
		},
		"services": [
			"www.file.io"
		]
	},
	"transfer.sh": {
		"file": {
			"field": null,
			"method": "PUT",
		},
		"services":[
			"transfer.sh",
			"files.reol.com",
			"up10.me",
			"transfer.nodl.it",
			"transfer.whalebone.io",
			"dl.digdeo.fr"
		],
		"detector": (d) =>{
			let els = document.getElementsByClassName("page-title");
			if(!els.length){
				els = document.getElementsByClassName("page-header");
			}
			if(els.length){
				return transferShRx.exec(els[0].textContent.replace(/\s+/g, " ").trim());
			}
		}
	},
}

function detectService(){
	for(let [k, s] of Object.entries(sw)){
		let d = s["detector"];
		let res = false;
		if(d){
			res = d(s);
		} else {
			let sS = new Set(s["services"]);
			res = sS.has(window.location.host);
		}
		if(res){
			return s;
		}
	}
}

const cur = detectService();

if(!cur){
	console.error("Service not detected!");
}

class Container {
	constructor(c) {
		this.forms = [];
		this.firstEl = document.body.children[0];
		this.c = document.createElement("span");
		this.radioContainer = document.createElement("span");
		this.radioContainer.id = "radios";
		this.c.appendChild(this.radioContainer);
		this.firstEl.parentElement.insertBefore(this.c, this.firstEl);
		this.activeForm = null;
	}
	selectFormListener(evt) {
		this.activeForm = evt.target.value;
		this.updateFormsVisibility();
	}
	updateFormsVisibility() {
		for (let f of this.forms) {
			f.fo.style.display = (f.name == this.activeForm) ? "block" : "none";
		}
	}
	add(f) {
		this.forms.push(f);
		this.c.appendChild(f.fo);
		f.ra.addEventListener("change", this.selectFormListener.bind(this), false);
	}
	createRadio(name) {
		const l = document.createElement("label");
		l.textContent = name;
		this.radioContainer.appendChild(l);

		const ra = document.createElement("input");
		ra.type = "radio";
		l["for"] = ra.id = "use_" + name;
		ra.value = name;
		ra.name = "mode";
		this.radioContainer.appendChild(ra);
		return ra
	}
}

class Form {
	constructor(c, descriptorName, formName, cur) {
		this.name = formName;
		this.descriptorName = descriptorName;
		this.ra = c.createRadio(formName);
		this.fo = document.createElement("form");
		console.log(cur, name, cur[descriptorName]);
		this.fo.method = cur[descriptorName]["method"];
		let uriFun = cur[descriptorName]["uri"];
		if(uriFun){
			let uri = uriFun(cur);
			console.log(uri);
			this.fo.action = uri;
		}
		this.fo.enctype = "multipart/form-data";
		this.sbm = document.createElement("input");
		this.sbm.type = "submit";
		this.fo.appendChild(this.sbm);

		c.add(this);
	}
};

class FileForm extends Form {
	constructor(c, cur) {
		super(c, "file", "file", cur);
		this.fi = document.createElement("input");
		this.fi.required = true;
		let fieldName = cur[this.descriptorName]["field"];
		if(fieldName){
			this.fi.name = fieldName;
		}
		this.fi.type = "file";
		this.fo.appendChild(this.fi);
	}
}

class LinkForm extends Form {
	constructor(c, cur) {
		super(c, "url", "shortener", cur);
		this.fi = document.createElement("input");
		this.fi.required = true;
		let fieldName = cur[this.descriptorName]["field"];
		if(fieldName){
			this.fi.name = fieldName;
		}
		this.fi.type = "url";
		this.fo.appendChild(this.fi);
	}
}

function sendDataXHR(d, descriptor, fileName, cspRestricted=false){
	let fieldName = descriptor["field"];
	let fd = null;
	d = new Blob([d], {
		"type": "text/plain"
	});
	if(fieldName){
		fd = new FormData();
		fd.append(fieldName, d, fileName);
	} else {
		fd = d;
	}
	alert("Sending request");
	function loadProcessor(txt) {
		document.body.textContent = txt;
	}
	
	let uri = null;
	let uriFun = descriptor["uri"];
	if(uriFun){
		uri = uriFun(cur);
	} else {
		uri = document.baseURI;
	}
	
	if(descriptor["method"] == "PUT"){
		uri += fileName
	} else {
		uri += (descriptor["uriAddition"] || "");
	}
	
	console.log(fd);
	if(!cspRestricted){
		fetch(uri, {
			method: descriptor["method"],
			body: fd,
			mode: "cors"
		}).then(r => r.text()).then(loadProcessor);
	} else {
		GM.xmlHttpRequest({
			method: descriptor["method"],
			url: uri,
			data: fd,
			onload: (response) => loadProcessor(response.responseText)
		});
	}
}

class TextAreaForm extends Form {
	constructor(c, cur) {
		super(c, "file", "text", cur);
		this.fi = document.createElement("textarea");
		this.fi.required = true;
		this.fi.placeholder = "Input/paste the text you want to post";
		this.fi.style.width = "100%";
		this.fo.appendChild(this.fi);

		this.fn = document.createElement("input");
		this.fn.type = "text";
		this.fn.value = "text.txt";
		this.fn.required = true;
		this.fn.placeholder = "File name to send. Currently not used by the backend.";
		this.fo.appendChild(this.fn);

		this.fo.addEventListener("submit", (evt) => {
			evt.preventDefault();
			evt.stopPropagation();
			sendDataXHR(this.fi.value, cur[this.descriptorName], this.fn.value, cur["cspRestricted"]);
		}, false);
	}
}

const c = new Container();
new FileForm(c, cur);
new TextAreaForm(c, cur);
if(cur["url"]){
	new LinkForm(c, cur);
}
c.activeForm = c.forms[0].name;
c.updateFormsVisibility();
