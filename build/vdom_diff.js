(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.vdom_diff = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

exports["default"] = function (obj) {
  return obj && obj.__esModule ? obj : {
    "default": obj
  };
};

exports.__esModule = true;
},{}],2:[function(require,module,exports){

},{}],3:[function(require,module,exports){
(function (global){
var topLevel = typeof global !== 'undefined' ? global :
    typeof window !== 'undefined' ? window : {}
var minDoc = require('min-document');

if (typeof document !== 'undefined') {
    module.exports = document;
} else {
    var doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'];

    if (!doccy) {
        doccy = topLevel['__GLOBAL_DOCUMENT_CACHE@4'] = minDoc;
    }

    module.exports = doccy;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"min-document":2}],4:[function(require,module,exports){

/**
 * index.js
 *
 * A client-side DOM to vdom parser based on DOMParser API
 */

'use strict';

var VNode = require('virtual-dom/vnode/vnode');
var VText = require('virtual-dom/vnode/vtext');
var domParser;

var propertyMap = require('./property-map');
var namespaceMap = require('./namespace-map');

var HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

module.exports = parser;

/**
 * DOM/html string to vdom parser
 *
 * @param   Mixed   el    DOM element or html string
 * @param   String  attr  Attribute name that contains vdom key
 * @return  Object        VNode or VText
 */
function parser(el, attr) {
	// empty input fallback to empty text node
	if (!el) {
		return createNode(document.createTextNode(''));
	}

	if (typeof el === 'string') {
		if ( !('DOMParser' in window) ) {
			throw new Error('DOMParser is not available, so parsing string to DOM node is not possible.');
		}
		domParser = domParser || new DOMParser();
		var doc = domParser.parseFromString(el, 'text/html');

		// most tags default to body
		if (doc.body.firstChild) {
			el = doc.getElementsByTagName('body')[0].firstChild;

		// some tags, like script and style, default to head
		} else if (doc.head.firstChild && (doc.head.firstChild.tagName !== 'TITLE' || doc.title)) {
			el = doc.head.firstChild;

		// special case for html comment, cdata, doctype
		} else if (doc.firstChild && doc.firstChild.tagName !== 'HTML') {
			el = doc.firstChild;

		// other element, such as whitespace, or html/body/head tag, fallback to empty text node
		} else {
			el = document.createTextNode('');
		}
	}

	if (typeof el !== 'object' || !el || !el.nodeType) {
		throw new Error('invalid dom node', el);
	}

	return createNode(el, attr);
}

/**
 * Create vdom from dom node
 *
 * @param   Object  el    DOM element
 * @param   String  attr  Attribute name that contains vdom key
 * @return  Object        VNode or VText
 */
function createNode(el, attr) {
	// html comment is not currently supported by virtual-dom
	if (el.nodeType === 3) {
		return createVirtualTextNode(el);

	// cdata or doctype is not currently supported by virtual-dom
	} else if (el.nodeType === 1 || el.nodeType === 9) {
		return createVirtualDomNode(el, attr);
	}

	// default to empty text node
	return new VText('');
}

/**
 * Create vtext from dom node
 *
 * @param   Object  el  Text node
 * @return  Object      VText
 */
function createVirtualTextNode(el) {
	return new VText(el.nodeValue);
}

/**
 * Create vnode from dom node
 *
 * @param   Object  el    DOM element
 * @param   String  attr  Attribute name that contains vdom key
 * @return  Object        VNode
 */
function createVirtualDomNode(el, attr) {
	var ns = el.namespaceURI !== HTML_NAMESPACE ? el.namespaceURI : null;
	var key = attr && el.getAttribute(attr) ? el.getAttribute(attr) : null;

	return new VNode(
		el.tagName
		, createProperties(el)
		, createChildren(el, attr)
		, key
		, ns
	);
}

/**
 * Recursively create vdom
 *
 * @param   Object  el    Parent element
 * @param   String  attr  Attribute name that contains vdom key
 * @return  Array         Child vnode or vtext
 */
function createChildren(el, attr) {
	var children = [];
	for (var i = 0; i < el.childNodes.length; i++) {
		children.push(createNode(el.childNodes[i], attr));
	};

	return children;
}

/**
 * Create properties from dom node
 *
 * @param   Object  el  DOM element
 * @return  Object      Node properties and attributes
 */
function createProperties(el) {
	var properties = {};

	if (!el.hasAttributes()) {
		return properties;
	}

	var ns;
	if (el.namespaceURI && el.namespaceURI !== HTML_NAMESPACE) {
		ns = el.namespaceURI;
	}

	var attr;
	for (var i = 0; i < el.attributes.length; i++) {
		// use built in css style parsing
		if(el.attributes[i].name == 'style'){
			attr = createStyleProperty(el);
		}
		else if (ns) {
			attr = createPropertyNS(el.attributes[i]);
		} else {
			attr = createProperty(el.attributes[i]);
		}

		// special case, namespaced attribute, use properties.foobar
		if (attr.ns) {
			properties[attr.name] = {
				namespace: attr.ns
				, value: attr.value
			};

		// special case, use properties.attributes.foobar
		} else if (attr.isAttr) {
			// init attributes object only when necessary
			if (!properties.attributes) {
				properties.attributes = {}
			}
			properties.attributes[attr.name] = attr.value;

		// default case, use properties.foobar
		} else {
			properties[attr.name] = attr.value;
		}
	};

	return properties;
}

/**
 * Create property from dom attribute
 *
 * @param   Object  attr  DOM attribute
 * @return  Object        Normalized attribute
 */
function createProperty(attr) {
	var name, value, isAttr;

	// using a map to find the correct case of property name
	if (propertyMap[attr.name]) {
		name = propertyMap[attr.name];
	} else {
		name = attr.name;
	}
	// special cases for data attribute, we default to properties.attributes.data
	if (name.indexOf('data-') === 0 || name.indexOf('aria-') === 0) {
		value = attr.value;
		isAttr = true;
	} else {
		value = attr.value;
	}

	return {
		name: name
		, value: value
		, isAttr: isAttr || false
	};
}

/**
 * Create namespaced property from dom attribute
 *
 * @param   Object  attr  DOM attribute
 * @return  Object        Normalized attribute
 */
function createPropertyNS(attr) {
	var name, value;

	return {
		name: attr.name
		, value: attr.value
		, ns: namespaceMap[attr.name] || ''
	};
}

/**
 * Create style property from dom node
 *
 * @param   Object  el  DOM node
 * @return  Object        Normalized attribute
 */
function createStyleProperty(el) {
	var style = el.style;
	var output = {};
	for (var i = 0; i < style.length; ++i) {
		var item = style.item(i);
		output[item] = style[item];
		// hack to workaround browser inconsistency with url()
		if (output[item].indexOf('url') > -1) {
			output[item] = output[item].replace(/\"/g, '')
		}
	}
	return { name: 'style', value: output };
}

},{"./namespace-map":5,"./property-map":6,"virtual-dom/vnode/vnode":24,"virtual-dom/vnode/vtext":26}],5:[function(require,module,exports){

/**
 * namespace-map.js
 *
 * Necessary to map svg attributes back to their namespace
 */

'use strict';

// extracted from https://github.com/Matt-Esch/virtual-dom/blob/master/virtual-hyperscript/svg-attribute-namespace.js
var DEFAULT_NAMESPACE = null;
var EV_NAMESPACE = 'http://www.w3.org/2001/xml-events';
var XLINK_NAMESPACE = 'http://www.w3.org/1999/xlink';
var XML_NAMESPACE = 'http://www.w3.org/XML/1998/namespace';

var namespaces = {
	'about': DEFAULT_NAMESPACE
	, 'accent-height': DEFAULT_NAMESPACE
	, 'accumulate': DEFAULT_NAMESPACE
	, 'additive': DEFAULT_NAMESPACE
	, 'alignment-baseline': DEFAULT_NAMESPACE
	, 'alphabetic': DEFAULT_NAMESPACE
	, 'amplitude': DEFAULT_NAMESPACE
	, 'arabic-form': DEFAULT_NAMESPACE
	, 'ascent': DEFAULT_NAMESPACE
	, 'attributeName': DEFAULT_NAMESPACE
	, 'attributeType': DEFAULT_NAMESPACE
	, 'azimuth': DEFAULT_NAMESPACE
	, 'bandwidth': DEFAULT_NAMESPACE
	, 'baseFrequency': DEFAULT_NAMESPACE
	, 'baseProfile': DEFAULT_NAMESPACE
	, 'baseline-shift': DEFAULT_NAMESPACE
	, 'bbox': DEFAULT_NAMESPACE
	, 'begin': DEFAULT_NAMESPACE
	, 'bias': DEFAULT_NAMESPACE
	, 'by': DEFAULT_NAMESPACE
	, 'calcMode': DEFAULT_NAMESPACE
	, 'cap-height': DEFAULT_NAMESPACE
	, 'class': DEFAULT_NAMESPACE
	, 'clip': DEFAULT_NAMESPACE
	, 'clip-path': DEFAULT_NAMESPACE
	, 'clip-rule': DEFAULT_NAMESPACE
	, 'clipPathUnits': DEFAULT_NAMESPACE
	, 'color': DEFAULT_NAMESPACE
	, 'color-interpolation': DEFAULT_NAMESPACE
	, 'color-interpolation-filters': DEFAULT_NAMESPACE
	, 'color-profile': DEFAULT_NAMESPACE
	, 'color-rendering': DEFAULT_NAMESPACE
	, 'content': DEFAULT_NAMESPACE
	, 'contentScriptType': DEFAULT_NAMESPACE
	, 'contentStyleType': DEFAULT_NAMESPACE
	, 'cursor': DEFAULT_NAMESPACE
	, 'cx': DEFAULT_NAMESPACE
	, 'cy': DEFAULT_NAMESPACE
	, 'd': DEFAULT_NAMESPACE
	, 'datatype': DEFAULT_NAMESPACE
	, 'defaultAction': DEFAULT_NAMESPACE
	, 'descent': DEFAULT_NAMESPACE
	, 'diffuseConstant': DEFAULT_NAMESPACE
	, 'direction': DEFAULT_NAMESPACE
	, 'display': DEFAULT_NAMESPACE
	, 'divisor': DEFAULT_NAMESPACE
	, 'dominant-baseline': DEFAULT_NAMESPACE
	, 'dur': DEFAULT_NAMESPACE
	, 'dx': DEFAULT_NAMESPACE
	, 'dy': DEFAULT_NAMESPACE
	, 'edgeMode': DEFAULT_NAMESPACE
	, 'editable': DEFAULT_NAMESPACE
	, 'elevation': DEFAULT_NAMESPACE
	, 'enable-background': DEFAULT_NAMESPACE
	, 'end': DEFAULT_NAMESPACE
	, 'ev:event': EV_NAMESPACE
	, 'event': DEFAULT_NAMESPACE
	, 'exponent': DEFAULT_NAMESPACE
	, 'externalResourcesRequired': DEFAULT_NAMESPACE
	, 'fill': DEFAULT_NAMESPACE
	, 'fill-opacity': DEFAULT_NAMESPACE
	, 'fill-rule': DEFAULT_NAMESPACE
	, 'filter': DEFAULT_NAMESPACE
	, 'filterRes': DEFAULT_NAMESPACE
	, 'filterUnits': DEFAULT_NAMESPACE
	, 'flood-color': DEFAULT_NAMESPACE
	, 'flood-opacity': DEFAULT_NAMESPACE
	, 'focusHighlight': DEFAULT_NAMESPACE
	, 'focusable': DEFAULT_NAMESPACE
	, 'font-family': DEFAULT_NAMESPACE
	, 'font-size': DEFAULT_NAMESPACE
	, 'font-size-adjust': DEFAULT_NAMESPACE
	, 'font-stretch': DEFAULT_NAMESPACE
	, 'font-style': DEFAULT_NAMESPACE
	, 'font-variant': DEFAULT_NAMESPACE
	, 'font-weight': DEFAULT_NAMESPACE
	, 'format': DEFAULT_NAMESPACE
	, 'from': DEFAULT_NAMESPACE
	, 'fx': DEFAULT_NAMESPACE
	, 'fy': DEFAULT_NAMESPACE
	, 'g1': DEFAULT_NAMESPACE
	, 'g2': DEFAULT_NAMESPACE
	, 'glyph-name': DEFAULT_NAMESPACE
	, 'glyph-orientation-horizontal': DEFAULT_NAMESPACE
	, 'glyph-orientation-vertical': DEFAULT_NAMESPACE
	, 'glyphRef': DEFAULT_NAMESPACE
	, 'gradientTransform': DEFAULT_NAMESPACE
	, 'gradientUnits': DEFAULT_NAMESPACE
	, 'handler': DEFAULT_NAMESPACE
	, 'hanging': DEFAULT_NAMESPACE
	, 'height': DEFAULT_NAMESPACE
	, 'horiz-adv-x': DEFAULT_NAMESPACE
	, 'horiz-origin-x': DEFAULT_NAMESPACE
	, 'horiz-origin-y': DEFAULT_NAMESPACE
	, 'id': DEFAULT_NAMESPACE
	, 'ideographic': DEFAULT_NAMESPACE
	, 'image-rendering': DEFAULT_NAMESPACE
	, 'in': DEFAULT_NAMESPACE
	, 'in2': DEFAULT_NAMESPACE
	, 'initialVisibility': DEFAULT_NAMESPACE
	, 'intercept': DEFAULT_NAMESPACE
	, 'k': DEFAULT_NAMESPACE
	, 'k1': DEFAULT_NAMESPACE
	, 'k2': DEFAULT_NAMESPACE
	, 'k3': DEFAULT_NAMESPACE
	, 'k4': DEFAULT_NAMESPACE
	, 'kernelMatrix': DEFAULT_NAMESPACE
	, 'kernelUnitLength': DEFAULT_NAMESPACE
	, 'kerning': DEFAULT_NAMESPACE
	, 'keyPoints': DEFAULT_NAMESPACE
	, 'keySplines': DEFAULT_NAMESPACE
	, 'keyTimes': DEFAULT_NAMESPACE
	, 'lang': DEFAULT_NAMESPACE
	, 'lengthAdjust': DEFAULT_NAMESPACE
	, 'letter-spacing': DEFAULT_NAMESPACE
	, 'lighting-color': DEFAULT_NAMESPACE
	, 'limitingConeAngle': DEFAULT_NAMESPACE
	, 'local': DEFAULT_NAMESPACE
	, 'marker-end': DEFAULT_NAMESPACE
	, 'marker-mid': DEFAULT_NAMESPACE
	, 'marker-start': DEFAULT_NAMESPACE
	, 'markerHeight': DEFAULT_NAMESPACE
	, 'markerUnits': DEFAULT_NAMESPACE
	, 'markerWidth': DEFAULT_NAMESPACE
	, 'mask': DEFAULT_NAMESPACE
	, 'maskContentUnits': DEFAULT_NAMESPACE
	, 'maskUnits': DEFAULT_NAMESPACE
	, 'mathematical': DEFAULT_NAMESPACE
	, 'max': DEFAULT_NAMESPACE
	, 'media': DEFAULT_NAMESPACE
	, 'mediaCharacterEncoding': DEFAULT_NAMESPACE
	, 'mediaContentEncodings': DEFAULT_NAMESPACE
	, 'mediaSize': DEFAULT_NAMESPACE
	, 'mediaTime': DEFAULT_NAMESPACE
	, 'method': DEFAULT_NAMESPACE
	, 'min': DEFAULT_NAMESPACE
	, 'mode': DEFAULT_NAMESPACE
	, 'name': DEFAULT_NAMESPACE
	, 'nav-down': DEFAULT_NAMESPACE
	, 'nav-down-left': DEFAULT_NAMESPACE
	, 'nav-down-right': DEFAULT_NAMESPACE
	, 'nav-left': DEFAULT_NAMESPACE
	, 'nav-next': DEFAULT_NAMESPACE
	, 'nav-prev': DEFAULT_NAMESPACE
	, 'nav-right': DEFAULT_NAMESPACE
	, 'nav-up': DEFAULT_NAMESPACE
	, 'nav-up-left': DEFAULT_NAMESPACE
	, 'nav-up-right': DEFAULT_NAMESPACE
	, 'numOctaves': DEFAULT_NAMESPACE
	, 'observer': DEFAULT_NAMESPACE
	, 'offset': DEFAULT_NAMESPACE
	, 'opacity': DEFAULT_NAMESPACE
	, 'operator': DEFAULT_NAMESPACE
	, 'order': DEFAULT_NAMESPACE
	, 'orient': DEFAULT_NAMESPACE
	, 'orientation': DEFAULT_NAMESPACE
	, 'origin': DEFAULT_NAMESPACE
	, 'overflow': DEFAULT_NAMESPACE
	, 'overlay': DEFAULT_NAMESPACE
	, 'overline-position': DEFAULT_NAMESPACE
	, 'overline-thickness': DEFAULT_NAMESPACE
	, 'panose-1': DEFAULT_NAMESPACE
	, 'path': DEFAULT_NAMESPACE
	, 'pathLength': DEFAULT_NAMESPACE
	, 'patternContentUnits': DEFAULT_NAMESPACE
	, 'patternTransform': DEFAULT_NAMESPACE
	, 'patternUnits': DEFAULT_NAMESPACE
	, 'phase': DEFAULT_NAMESPACE
	, 'playbackOrder': DEFAULT_NAMESPACE
	, 'pointer-events': DEFAULT_NAMESPACE
	, 'points': DEFAULT_NAMESPACE
	, 'pointsAtX': DEFAULT_NAMESPACE
	, 'pointsAtY': DEFAULT_NAMESPACE
	, 'pointsAtZ': DEFAULT_NAMESPACE
	, 'preserveAlpha': DEFAULT_NAMESPACE
	, 'preserveAspectRatio': DEFAULT_NAMESPACE
	, 'primitiveUnits': DEFAULT_NAMESPACE
	, 'propagate': DEFAULT_NAMESPACE
	, 'property': DEFAULT_NAMESPACE
	, 'r': DEFAULT_NAMESPACE
	, 'radius': DEFAULT_NAMESPACE
	, 'refX': DEFAULT_NAMESPACE
	, 'refY': DEFAULT_NAMESPACE
	, 'rel': DEFAULT_NAMESPACE
	, 'rendering-intent': DEFAULT_NAMESPACE
	, 'repeatCount': DEFAULT_NAMESPACE
	, 'repeatDur': DEFAULT_NAMESPACE
	, 'requiredExtensions': DEFAULT_NAMESPACE
	, 'requiredFeatures': DEFAULT_NAMESPACE
	, 'requiredFonts': DEFAULT_NAMESPACE
	, 'requiredFormats': DEFAULT_NAMESPACE
	, 'resource': DEFAULT_NAMESPACE
	, 'restart': DEFAULT_NAMESPACE
	, 'result': DEFAULT_NAMESPACE
	, 'rev': DEFAULT_NAMESPACE
	, 'role': DEFAULT_NAMESPACE
	, 'rotate': DEFAULT_NAMESPACE
	, 'rx': DEFAULT_NAMESPACE
	, 'ry': DEFAULT_NAMESPACE
	, 'scale': DEFAULT_NAMESPACE
	, 'seed': DEFAULT_NAMESPACE
	, 'shape-rendering': DEFAULT_NAMESPACE
	, 'slope': DEFAULT_NAMESPACE
	, 'snapshotTime': DEFAULT_NAMESPACE
	, 'spacing': DEFAULT_NAMESPACE
	, 'specularConstant': DEFAULT_NAMESPACE
	, 'specularExponent': DEFAULT_NAMESPACE
	, 'spreadMethod': DEFAULT_NAMESPACE
	, 'startOffset': DEFAULT_NAMESPACE
	, 'stdDeviation': DEFAULT_NAMESPACE
	, 'stemh': DEFAULT_NAMESPACE
	, 'stemv': DEFAULT_NAMESPACE
	, 'stitchTiles': DEFAULT_NAMESPACE
	, 'stop-color': DEFAULT_NAMESPACE
	, 'stop-opacity': DEFAULT_NAMESPACE
	, 'strikethrough-position': DEFAULT_NAMESPACE
	, 'strikethrough-thickness': DEFAULT_NAMESPACE
	, 'string': DEFAULT_NAMESPACE
	, 'stroke': DEFAULT_NAMESPACE
	, 'stroke-dasharray': DEFAULT_NAMESPACE
	, 'stroke-dashoffset': DEFAULT_NAMESPACE
	, 'stroke-linecap': DEFAULT_NAMESPACE
	, 'stroke-linejoin': DEFAULT_NAMESPACE
	, 'stroke-miterlimit': DEFAULT_NAMESPACE
	, 'stroke-opacity': DEFAULT_NAMESPACE
	, 'stroke-width': DEFAULT_NAMESPACE
	, 'surfaceScale': DEFAULT_NAMESPACE
	, 'syncBehavior': DEFAULT_NAMESPACE
	, 'syncBehaviorDefault': DEFAULT_NAMESPACE
	, 'syncMaster': DEFAULT_NAMESPACE
	, 'syncTolerance': DEFAULT_NAMESPACE
	, 'syncToleranceDefault': DEFAULT_NAMESPACE
	, 'systemLanguage': DEFAULT_NAMESPACE
	, 'tableValues': DEFAULT_NAMESPACE
	, 'target': DEFAULT_NAMESPACE
	, 'targetX': DEFAULT_NAMESPACE
	, 'targetY': DEFAULT_NAMESPACE
	, 'text-anchor': DEFAULT_NAMESPACE
	, 'text-decoration': DEFAULT_NAMESPACE
	, 'text-rendering': DEFAULT_NAMESPACE
	, 'textLength': DEFAULT_NAMESPACE
	, 'timelineBegin': DEFAULT_NAMESPACE
	, 'title': DEFAULT_NAMESPACE
	, 'to': DEFAULT_NAMESPACE
	, 'transform': DEFAULT_NAMESPACE
	, 'transformBehavior': DEFAULT_NAMESPACE
	, 'type': DEFAULT_NAMESPACE
	, 'typeof': DEFAULT_NAMESPACE
	, 'u1': DEFAULT_NAMESPACE
	, 'u2': DEFAULT_NAMESPACE
	, 'underline-position': DEFAULT_NAMESPACE
	, 'underline-thickness': DEFAULT_NAMESPACE
	, 'unicode': DEFAULT_NAMESPACE
	, 'unicode-bidi': DEFAULT_NAMESPACE
	, 'unicode-range': DEFAULT_NAMESPACE
	, 'units-per-em': DEFAULT_NAMESPACE
	, 'v-alphabetic': DEFAULT_NAMESPACE
	, 'v-hanging': DEFAULT_NAMESPACE
	, 'v-ideographic': DEFAULT_NAMESPACE
	, 'v-mathematical': DEFAULT_NAMESPACE
	, 'values': DEFAULT_NAMESPACE
	, 'version': DEFAULT_NAMESPACE
	, 'vert-adv-y': DEFAULT_NAMESPACE
	, 'vert-origin-x': DEFAULT_NAMESPACE
	, 'vert-origin-y': DEFAULT_NAMESPACE
	, 'viewBox': DEFAULT_NAMESPACE
	, 'viewTarget': DEFAULT_NAMESPACE
	, 'visibility': DEFAULT_NAMESPACE
	, 'width': DEFAULT_NAMESPACE
	, 'widths': DEFAULT_NAMESPACE
	, 'word-spacing': DEFAULT_NAMESPACE
	, 'writing-mode': DEFAULT_NAMESPACE
	, 'x': DEFAULT_NAMESPACE
	, 'x-height': DEFAULT_NAMESPACE
	, 'x1': DEFAULT_NAMESPACE
	, 'x2': DEFAULT_NAMESPACE
	, 'xChannelSelector': DEFAULT_NAMESPACE
	, 'xlink:actuate': XLINK_NAMESPACE
	, 'xlink:arcrole': XLINK_NAMESPACE
	, 'xlink:href': XLINK_NAMESPACE
	, 'xlink:role': XLINK_NAMESPACE
	, 'xlink:show': XLINK_NAMESPACE
	, 'xlink:title': XLINK_NAMESPACE
	, 'xlink:type': XLINK_NAMESPACE
	, 'xml:base': XML_NAMESPACE
	, 'xml:id': XML_NAMESPACE
	, 'xml:lang': XML_NAMESPACE
	, 'xml:space': XML_NAMESPACE
	, 'y': DEFAULT_NAMESPACE
	, 'y1': DEFAULT_NAMESPACE
	, 'y2': DEFAULT_NAMESPACE
	, 'yChannelSelector': DEFAULT_NAMESPACE
	, 'z': DEFAULT_NAMESPACE
	, 'zoomAndPan': DEFAULT_NAMESPACE
};

module.exports = namespaces;

},{}],6:[function(require,module,exports){

/**
 * property-map.js
 *
 * Necessary to map dom attributes back to vdom properties
 */

'use strict';

// invert of https://www.npmjs.com/package/html-attributes
var properties = {
	'abbr': 'abbr'
	, 'accept': 'accept'
	, 'accept-charset': 'acceptCharset'
	, 'accesskey': 'accessKey'
	, 'action': 'action'
	, 'allowfullscreen': 'allowFullScreen'
	, 'allowtransparency': 'allowTransparency'
	, 'alt': 'alt'
	, 'async': 'async'
	, 'autocomplete': 'autoComplete'
	, 'autofocus': 'autoFocus'
	, 'autoplay': 'autoPlay'
	, 'cellpadding': 'cellPadding'
	, 'cellspacing': 'cellSpacing'
	, 'challenge': 'challenge'
	, 'charset': 'charset'
	, 'checked': 'checked'
	, 'cite': 'cite'
	, 'class': 'className'
	, 'cols': 'cols'
	, 'colspan': 'colSpan'
	, 'command': 'command'
	, 'content': 'content'
	, 'contenteditable': 'contentEditable'
	, 'contextmenu': 'contextMenu'
	, 'controls': 'controls'
	, 'coords': 'coords'
	, 'crossorigin': 'crossOrigin'
	, 'data': 'data'
	, 'datetime': 'dateTime'
	, 'default': 'default'
	, 'defer': 'defer'
	, 'dir': 'dir'
	, 'disabled': 'disabled'
	, 'download': 'download'
	, 'draggable': 'draggable'
	, 'dropzone': 'dropzone'
	, 'enctype': 'encType'
	, 'for': 'htmlFor'
	, 'form': 'form'
	, 'formaction': 'formAction'
	, 'formenctype': 'formEncType'
	, 'formmethod': 'formMethod'
	, 'formnovalidate': 'formNoValidate'
	, 'formtarget': 'formTarget'
	, 'frameBorder': 'frameBorder'
	, 'headers': 'headers'
	, 'height': 'height'
	, 'hidden': 'hidden'
	, 'high': 'high'
	, 'href': 'href'
	, 'hreflang': 'hrefLang'
	, 'http-equiv': 'httpEquiv'
	, 'icon': 'icon'
	, 'id': 'id'
	, 'inputmode': 'inputMode'
	, 'ismap': 'isMap'
	, 'itemid': 'itemId'
	, 'itemprop': 'itemProp'
	, 'itemref': 'itemRef'
	, 'itemscope': 'itemScope'
	, 'itemtype': 'itemType'
	, 'kind': 'kind'
	, 'label': 'label'
	, 'lang': 'lang'
	, 'list': 'list'
	, 'loop': 'loop'
	, 'manifest': 'manifest'
	, 'max': 'max'
	, 'maxlength': 'maxLength'
	, 'media': 'media'
	, 'mediagroup': 'mediaGroup'
	, 'method': 'method'
	, 'min': 'min'
	, 'minlength': 'minLength'
	, 'multiple': 'multiple'
	, 'muted': 'muted'
	, 'name': 'name'
	, 'novalidate': 'noValidate'
	, 'open': 'open'
	, 'optimum': 'optimum'
	, 'pattern': 'pattern'
	, 'ping': 'ping'
	, 'placeholder': 'placeholder'
	, 'poster': 'poster'
	, 'preload': 'preload'
	, 'radiogroup': 'radioGroup'
	, 'readonly': 'readOnly'
	, 'rel': 'rel'
	, 'required': 'required'
	, 'role': 'role'
	, 'rows': 'rows'
	, 'rowspan': 'rowSpan'
	, 'sandbox': 'sandbox'
	, 'scope': 'scope'
	, 'scoped': 'scoped'
	, 'scrolling': 'scrolling'
	, 'seamless': 'seamless'
	, 'selected': 'selected'
	, 'shape': 'shape'
	, 'size': 'size'
	, 'sizes': 'sizes'
	, 'sortable': 'sortable'
	, 'span': 'span'
	, 'spellcheck': 'spellCheck'
	, 'src': 'src'
	, 'srcdoc': 'srcDoc'
	, 'srcset': 'srcSet'
	, 'start': 'start'
	, 'step': 'step'
	, 'style': 'style'
	, 'tabindex': 'tabIndex'
	, 'target': 'target'
	, 'title': 'title'
	, 'translate': 'translate'
	, 'type': 'type'
	, 'typemustmatch': 'typeMustMatch'
	, 'usemap': 'useMap'
	, 'value': 'value'
	, 'width': 'width'
	, 'wmode': 'wmode'
	, 'wrap': 'wrap'
};

module.exports = properties;

},{}],7:[function(require,module,exports){
var createElement = require("./vdom/create-element.js")

module.exports = createElement

},{"./vdom/create-element.js":12}],8:[function(require,module,exports){
var diff = require("./vtree/diff.js")

module.exports = diff

},{"./vtree/diff.js":28}],9:[function(require,module,exports){
"use strict";

module.exports = function isObject(x) {
	return typeof x === "object" && x !== null;
};

},{}],10:[function(require,module,exports){
var patch = require("./vdom/patch.js")

module.exports = patch

},{"./vdom/patch.js":15}],11:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook.js")

module.exports = applyProperties

function applyProperties(node, props, previous) {
    for (var propName in props) {
        var propValue = props[propName]

        if (propValue === undefined) {
            removeProperty(node, propName, propValue, previous);
        } else if (isHook(propValue)) {
            removeProperty(node, propName, propValue, previous)
            if (propValue.hook) {
                propValue.hook(node,
                    propName,
                    previous ? previous[propName] : undefined)
            }
        } else {
            if (isObject(propValue)) {
                patchObject(node, props, previous, propName, propValue);
            } else {
                node[propName] = propValue
            }
        }
    }
}

function removeProperty(node, propName, propValue, previous) {
    if (previous) {
        var previousValue = previous[propName]

        if (!isHook(previousValue)) {
            if (propName === "attributes") {
                for (var attrName in previousValue) {
                    node.removeAttribute(attrName)
                }
            } else if (propName === "style") {
                for (var i in previousValue) {
                    node.style[i] = ""
                }
            } else if (typeof previousValue === "string") {
                node[propName] = ""
            } else {
                node[propName] = null
            }
        } else if (previousValue.unhook) {
            previousValue.unhook(node, propName, propValue)
        }
    }
}

function patchObject(node, props, previous, propName, propValue) {
    var previousValue = previous ? previous[propName] : undefined

    // Set attributes
    if (propName === "attributes") {
        for (var attrName in propValue) {
            var attrValue = propValue[attrName]

            if (attrValue === undefined) {
                node.removeAttribute(attrName)
            } else {
                node.setAttribute(attrName, attrValue)
            }
        }

        return
    }

    if(previousValue && isObject(previousValue) &&
        getPrototype(previousValue) !== getPrototype(propValue)) {
        node[propName] = propValue
        return
    }

    if (!isObject(node[propName])) {
        node[propName] = {}
    }

    var replacer = propName === "style" ? "" : undefined

    for (var k in propValue) {
        var value = propValue[k]
        node[propName][k] = (value === undefined) ? replacer : value
    }
}

function getPrototype(value) {
    if (Object.getPrototypeOf) {
        return Object.getPrototypeOf(value)
    } else if (value.__proto__) {
        return value.__proto__
    } else if (value.constructor) {
        return value.constructor.prototype
    }
}

},{"../vnode/is-vhook.js":19,"is-object":9}],12:[function(require,module,exports){
var document = require("global/document")

var applyProperties = require("./apply-properties")

var isVNode = require("../vnode/is-vnode.js")
var isVText = require("../vnode/is-vtext.js")
var isWidget = require("../vnode/is-widget.js")
var handleThunk = require("../vnode/handle-thunk.js")

module.exports = createElement

function createElement(vnode, opts) {
    var doc = opts ? opts.document || document : document
    var warn = opts ? opts.warn : null

    vnode = handleThunk(vnode).a

    if (isWidget(vnode)) {
        return vnode.init()
    } else if (isVText(vnode)) {
        return doc.createTextNode(vnode.text)
    } else if (!isVNode(vnode)) {
        if (warn) {
            warn("Item is not a valid virtual dom node", vnode)
        }
        return null
    }

    var node = (vnode.namespace === null) ?
        doc.createElement(vnode.tagName) :
        doc.createElementNS(vnode.namespace, vnode.tagName)

    var props = vnode.properties
    applyProperties(node, props)

    var children = vnode.children

    for (var i = 0; i < children.length; i++) {
        var childNode = createElement(children[i], opts)
        if (childNode) {
            node.appendChild(childNode)
        }
    }

    return node
}

},{"../vnode/handle-thunk.js":17,"../vnode/is-vnode.js":20,"../vnode/is-vtext.js":21,"../vnode/is-widget.js":22,"./apply-properties":11,"global/document":3}],13:[function(require,module,exports){
// Maps a virtual DOM tree onto a real DOM tree in an efficient manner.
// We don't want to read all of the DOM nodes in the tree so we use
// the in-order tree indexing to eliminate recursion down certain branches.
// We only recurse into a DOM node if we know that it contains a child of
// interest.

var noChild = {}

module.exports = domIndex

function domIndex(rootNode, tree, indices, nodes) {
    if (!indices || indices.length === 0) {
        return {}
    } else {
        indices.sort(ascending)
        return recurse(rootNode, tree, indices, nodes, 0)
    }
}

function recurse(rootNode, tree, indices, nodes, rootIndex) {
    nodes = nodes || {}


    if (rootNode) {
        if (indexInRange(indices, rootIndex, rootIndex)) {
            nodes[rootIndex] = rootNode
        }

        var vChildren = tree.children

        if (vChildren) {

            var childNodes = rootNode.childNodes

            for (var i = 0; i < tree.children.length; i++) {
                rootIndex += 1

                var vChild = vChildren[i] || noChild
                var nextIndex = rootIndex + (vChild.count || 0)

                // skip recursion down the tree if there are no nodes down here
                if (indexInRange(indices, rootIndex, nextIndex)) {
                    recurse(childNodes[i], vChild, indices, nodes, rootIndex)
                }

                rootIndex = nextIndex
            }
        }
    }

    return nodes
}

// Binary search for an index in the interval [left, right]
function indexInRange(indices, left, right) {
    if (indices.length === 0) {
        return false
    }

    var minIndex = 0
    var maxIndex = indices.length - 1
    var currentIndex
    var currentItem

    while (minIndex <= maxIndex) {
        currentIndex = ((maxIndex + minIndex) / 2) >> 0
        currentItem = indices[currentIndex]

        if (minIndex === maxIndex) {
            return currentItem >= left && currentItem <= right
        } else if (currentItem < left) {
            minIndex = currentIndex + 1
        } else  if (currentItem > right) {
            maxIndex = currentIndex - 1
        } else {
            return true
        }
    }

    return false;
}

function ascending(a, b) {
    return a > b ? 1 : -1
}

},{}],14:[function(require,module,exports){
var applyProperties = require("./apply-properties")

var isWidget = require("../vnode/is-widget.js")
var VPatch = require("../vnode/vpatch.js")

var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode) {
        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = renderOptions.render(vText, renderOptions)

        if (parentNode && newNode !== domNode) {
            parentNode.replaceChild(newNode, domNode)
        }
    }

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    var updating = updateWidget(leftVNode, widget)
    var newNode

    if (updating) {
        newNode = widget.update(leftVNode, domNode) || domNode
    } else {
        newNode = renderOptions.render(widget, renderOptions)
    }

    var parentNode = domNode.parentNode

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    if (!updating) {
        destroyWidget(domNode, leftVNode)
    }

    return newNode
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = renderOptions.render(vNode, renderOptions)

    if (parentNode && newNode !== domNode) {
        parentNode.replaceChild(newNode, domNode)
    }

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, moves) {
    var childNodes = domNode.childNodes
    var keyMap = {}
    var node
    var remove
    var insert

    for (var i = 0; i < moves.removes.length; i++) {
        remove = moves.removes[i]
        node = childNodes[remove.from]
        if (remove.key) {
            keyMap[remove.key] = node
        }
        domNode.removeChild(node)
    }

    var length = childNodes.length
    for (var j = 0; j < moves.inserts.length; j++) {
        insert = moves.inserts[j]
        node = keyMap[insert.key]
        // this is the weirdest bug i've ever seen in webkit
        domNode.insertBefore(node, insert.to >= length++ ? null : childNodes[insert.to])
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}

},{"../vnode/is-widget.js":22,"../vnode/vpatch.js":25,"./apply-properties":11,"./update-widget":16}],15:[function(require,module,exports){
var document = require("global/document")
var isArray = require("x-is-array")

var render = require("./create-element")
var domIndex = require("./dom-index")
var patchOp = require("./patch-op")
module.exports = patch

function patch(rootNode, patches, renderOptions) {
    renderOptions = renderOptions || {}
    renderOptions.patch = renderOptions.patch && renderOptions.patch !== patch
        ? renderOptions.patch
        : patchRecursive
    renderOptions.render = renderOptions.render || render

    return renderOptions.patch(rootNode, patches, renderOptions)
}

function patchRecursive(rootNode, patches, renderOptions) {
    var indices = patchIndices(patches)

    if (indices.length === 0) {
        return rootNode
    }

    var index = domIndex(rootNode, patches.a, indices)
    var ownerDocument = rootNode.ownerDocument

    if (!renderOptions.document && ownerDocument !== document) {
        renderOptions.document = ownerDocument
    }

    for (var i = 0; i < indices.length; i++) {
        var nodeIndex = indices[i]
        rootNode = applyPatch(rootNode,
            index[nodeIndex],
            patches[nodeIndex],
            renderOptions)
    }

    return rootNode
}

function applyPatch(rootNode, domNode, patchList, renderOptions) {
    if (!domNode) {
        return rootNode
    }

    var newNode

    if (isArray(patchList)) {
        for (var i = 0; i < patchList.length; i++) {
            newNode = patchOp(patchList[i], domNode, renderOptions)

            if (domNode === rootNode) {
                rootNode = newNode
            }
        }
    } else {
        newNode = patchOp(patchList, domNode, renderOptions)

        if (domNode === rootNode) {
            rootNode = newNode
        }
    }

    return rootNode
}

function patchIndices(patches) {
    var indices = []

    for (var key in patches) {
        if (key !== "a") {
            indices.push(Number(key))
        }
    }

    return indices
}

},{"./create-element":12,"./dom-index":13,"./patch-op":14,"global/document":3,"x-is-array":29}],16:[function(require,module,exports){
var isWidget = require("../vnode/is-widget.js")

module.exports = updateWidget

function updateWidget(a, b) {
    if (isWidget(a) && isWidget(b)) {
        if ("name" in a && "name" in b) {
            return a.id === b.id
        } else {
            return a.init === b.init
        }
    }

    return false
}

},{"../vnode/is-widget.js":22}],17:[function(require,module,exports){
var isVNode = require("./is-vnode")
var isVText = require("./is-vtext")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")

module.exports = handleThunk

function handleThunk(a, b) {
    var renderedA = a
    var renderedB = b

    if (isThunk(b)) {
        renderedB = renderThunk(b, a)
    }

    if (isThunk(a)) {
        renderedA = renderThunk(a, null)
    }

    return {
        a: renderedA,
        b: renderedB
    }
}

function renderThunk(thunk, previous) {
    var renderedThunk = thunk.vnode

    if (!renderedThunk) {
        renderedThunk = thunk.vnode = thunk.render(previous)
    }

    if (!(isVNode(renderedThunk) ||
            isVText(renderedThunk) ||
            isWidget(renderedThunk))) {
        throw new Error("thunk did not return a valid node");
    }

    return renderedThunk
}

},{"./is-thunk":18,"./is-vnode":20,"./is-vtext":21,"./is-widget":22}],18:[function(require,module,exports){
module.exports = isThunk

function isThunk(t) {
    return t && t.type === "Thunk"
}

},{}],19:[function(require,module,exports){
module.exports = isHook

function isHook(hook) {
    return hook &&
      (typeof hook.hook === "function" && !hook.hasOwnProperty("hook") ||
       typeof hook.unhook === "function" && !hook.hasOwnProperty("unhook"))
}

},{}],20:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualNode

function isVirtualNode(x) {
    return x && x.type === "VirtualNode" && x.version === version
}

},{"./version":23}],21:[function(require,module,exports){
var version = require("./version")

module.exports = isVirtualText

function isVirtualText(x) {
    return x && x.type === "VirtualText" && x.version === version
}

},{"./version":23}],22:[function(require,module,exports){
module.exports = isWidget

function isWidget(w) {
    return w && w.type === "Widget"
}

},{}],23:[function(require,module,exports){
module.exports = "2"

},{}],24:[function(require,module,exports){
var version = require("./version")
var isVNode = require("./is-vnode")
var isWidget = require("./is-widget")
var isThunk = require("./is-thunk")
var isVHook = require("./is-vhook")

module.exports = VirtualNode

var noProperties = {}
var noChildren = []

function VirtualNode(tagName, properties, children, key, namespace) {
    this.tagName = tagName
    this.properties = properties || noProperties
    this.children = children || noChildren
    this.key = key != null ? String(key) : undefined
    this.namespace = (typeof namespace === "string") ? namespace : null

    var count = (children && children.length) || 0
    var descendants = 0
    var hasWidgets = false
    var hasThunks = false
    var descendantHooks = false
    var hooks

    for (var propName in properties) {
        if (properties.hasOwnProperty(propName)) {
            var property = properties[propName]
            if (isVHook(property) && property.unhook) {
                if (!hooks) {
                    hooks = {}
                }

                hooks[propName] = property
            }
        }
    }

    for (var i = 0; i < count; i++) {
        var child = children[i]
        if (isVNode(child)) {
            descendants += child.count || 0

            if (!hasWidgets && child.hasWidgets) {
                hasWidgets = true
            }

            if (!hasThunks && child.hasThunks) {
                hasThunks = true
            }

            if (!descendantHooks && (child.hooks || child.descendantHooks)) {
                descendantHooks = true
            }
        } else if (!hasWidgets && isWidget(child)) {
            if (typeof child.destroy === "function") {
                hasWidgets = true
            }
        } else if (!hasThunks && isThunk(child)) {
            hasThunks = true;
        }
    }

    this.count = count + descendants
    this.hasWidgets = hasWidgets
    this.hasThunks = hasThunks
    this.hooks = hooks
    this.descendantHooks = descendantHooks
}

VirtualNode.prototype.version = version
VirtualNode.prototype.type = "VirtualNode"

},{"./is-thunk":18,"./is-vhook":19,"./is-vnode":20,"./is-widget":22,"./version":23}],25:[function(require,module,exports){
var version = require("./version")

VirtualPatch.NONE = 0
VirtualPatch.VTEXT = 1
VirtualPatch.VNODE = 2
VirtualPatch.WIDGET = 3
VirtualPatch.PROPS = 4
VirtualPatch.ORDER = 5
VirtualPatch.INSERT = 6
VirtualPatch.REMOVE = 7
VirtualPatch.THUNK = 8

module.exports = VirtualPatch

function VirtualPatch(type, vNode, patch) {
    this.type = Number(type)
    this.vNode = vNode
    this.patch = patch
}

VirtualPatch.prototype.version = version
VirtualPatch.prototype.type = "VirtualPatch"

},{"./version":23}],26:[function(require,module,exports){
var version = require("./version")

module.exports = VirtualText

function VirtualText(text) {
    this.text = String(text)
}

VirtualText.prototype.version = version
VirtualText.prototype.type = "VirtualText"

},{"./version":23}],27:[function(require,module,exports){
var isObject = require("is-object")
var isHook = require("../vnode/is-vhook")

module.exports = diffProps

function diffProps(a, b) {
    var diff

    for (var aKey in a) {
        if (!(aKey in b)) {
            diff = diff || {}
            diff[aKey] = undefined
        }

        var aValue = a[aKey]
        var bValue = b[aKey]

        if (aValue === bValue) {
            continue
        } else if (isObject(aValue) && isObject(bValue)) {
            if (getPrototype(bValue) !== getPrototype(aValue)) {
                diff = diff || {}
                diff[aKey] = bValue
            } else if (isHook(bValue)) {
                 diff = diff || {}
                 diff[aKey] = bValue
            } else {
                var objectDiff = diffProps(aValue, bValue)
                if (objectDiff) {
                    diff = diff || {}
                    diff[aKey] = objectDiff
                }
            }
        } else {
            diff = diff || {}
            diff[aKey] = bValue
        }
    }

    for (var bKey in b) {
        if (!(bKey in a)) {
            diff = diff || {}
            diff[bKey] = b[bKey]
        }
    }

    return diff
}

function getPrototype(value) {
  if (Object.getPrototypeOf) {
    return Object.getPrototypeOf(value)
  } else if (value.__proto__) {
    return value.__proto__
  } else if (value.constructor) {
    return value.constructor.prototype
  }
}

},{"../vnode/is-vhook":19,"is-object":9}],28:[function(require,module,exports){
var isArray = require("x-is-array")

var VPatch = require("../vnode/vpatch")
var isVNode = require("../vnode/is-vnode")
var isVText = require("../vnode/is-vtext")
var isWidget = require("../vnode/is-widget")
var isThunk = require("../vnode/is-thunk")
var handleThunk = require("../vnode/handle-thunk")

var diffProps = require("./diff-props")

module.exports = diff

function diff(a, b) {
    var patch = { a: a }
    walk(a, b, patch, 0)
    return patch
}

function walk(a, b, patch, index) {
    if (a === b) {
        return
    }

    var apply = patch[index]
    var applyClear = false

    if (isThunk(a) || isThunk(b)) {
        thunks(a, b, patch, index)
    } else if (b == null) {

        // If a is a widget we will add a remove patch for it
        // Otherwise any child widgets/hooks must be destroyed.
        // This prevents adding two remove patches for a widget.
        if (!isWidget(a)) {
            clearState(a, patch, index)
            apply = patch[index]
        }

        apply = appendPatch(apply, new VPatch(VPatch.REMOVE, a, b))
    } else if (isVNode(b)) {
        if (isVNode(a)) {
            if (a.tagName === b.tagName &&
                a.namespace === b.namespace &&
                a.key === b.key) {
                var propsPatch = diffProps(a.properties, b.properties)
                if (propsPatch) {
                    apply = appendPatch(apply,
                        new VPatch(VPatch.PROPS, a, propsPatch))
                }
                apply = diffChildren(a, b, patch, apply, index)
            } else {
                apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
                applyClear = true
            }
        } else {
            apply = appendPatch(apply, new VPatch(VPatch.VNODE, a, b))
            applyClear = true
        }
    } else if (isVText(b)) {
        if (!isVText(a)) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
            applyClear = true
        } else if (a.text !== b.text) {
            apply = appendPatch(apply, new VPatch(VPatch.VTEXT, a, b))
        }
    } else if (isWidget(b)) {
        if (!isWidget(a)) {
            applyClear = true
        }

        apply = appendPatch(apply, new VPatch(VPatch.WIDGET, a, b))
    }

    if (apply) {
        patch[index] = apply
    }

    if (applyClear) {
        clearState(a, patch, index)
    }
}

function diffChildren(a, b, patch, apply, index) {
    var aChildren = a.children
    var orderedSet = reorder(aChildren, b.children)
    var bChildren = orderedSet.children

    var aLen = aChildren.length
    var bLen = bChildren.length
    var len = aLen > bLen ? aLen : bLen

    for (var i = 0; i < len; i++) {
        var leftNode = aChildren[i]
        var rightNode = bChildren[i]
        index += 1

        if (!leftNode) {
            if (rightNode) {
                // Excess nodes in b need to be added
                apply = appendPatch(apply,
                    new VPatch(VPatch.INSERT, null, rightNode))
            }
        } else {
            walk(leftNode, rightNode, patch, index)
        }

        if (isVNode(leftNode) && leftNode.count) {
            index += leftNode.count
        }
    }

    if (orderedSet.moves) {
        // Reorder nodes last
        apply = appendPatch(apply, new VPatch(
            VPatch.ORDER,
            a,
            orderedSet.moves
        ))
    }

    return apply
}

function clearState(vNode, patch, index) {
    // TODO: Make this a single walk, not two
    unhook(vNode, patch, index)
    destroyWidgets(vNode, patch, index)
}

// Patch records for all destroyed widgets must be added because we need
// a DOM node reference for the destroy function
function destroyWidgets(vNode, patch, index) {
    if (isWidget(vNode)) {
        if (typeof vNode.destroy === "function") {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(VPatch.REMOVE, vNode, null)
            )
        }
    } else if (isVNode(vNode) && (vNode.hasWidgets || vNode.hasThunks)) {
        var children = vNode.children
        var len = children.length
        for (var i = 0; i < len; i++) {
            var child = children[i]
            index += 1

            destroyWidgets(child, patch, index)

            if (isVNode(child) && child.count) {
                index += child.count
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

// Create a sub-patch for thunks
function thunks(a, b, patch, index) {
    var nodes = handleThunk(a, b)
    var thunkPatch = diff(nodes.a, nodes.b)
    if (hasPatches(thunkPatch)) {
        patch[index] = new VPatch(VPatch.THUNK, null, thunkPatch)
    }
}

function hasPatches(patch) {
    for (var index in patch) {
        if (index !== "a") {
            return true
        }
    }

    return false
}

// Execute hooks when two nodes are identical
function unhook(vNode, patch, index) {
    if (isVNode(vNode)) {
        if (vNode.hooks) {
            patch[index] = appendPatch(
                patch[index],
                new VPatch(
                    VPatch.PROPS,
                    vNode,
                    undefinedKeys(vNode.hooks)
                )
            )
        }

        if (vNode.descendantHooks || vNode.hasThunks) {
            var children = vNode.children
            var len = children.length
            for (var i = 0; i < len; i++) {
                var child = children[i]
                index += 1

                unhook(child, patch, index)

                if (isVNode(child) && child.count) {
                    index += child.count
                }
            }
        }
    } else if (isThunk(vNode)) {
        thunks(vNode, null, patch, index)
    }
}

function undefinedKeys(obj) {
    var result = {}

    for (var key in obj) {
        result[key] = undefined
    }

    return result
}

// List diff, naive left to right reordering
function reorder(aChildren, bChildren) {
    // O(M) time, O(M) memory
    var bChildIndex = keyIndex(bChildren)
    var bKeys = bChildIndex.keys
    var bFree = bChildIndex.free

    if (bFree.length === bChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(N) time, O(N) memory
    var aChildIndex = keyIndex(aChildren)
    var aKeys = aChildIndex.keys
    var aFree = aChildIndex.free

    if (aFree.length === aChildren.length) {
        return {
            children: bChildren,
            moves: null
        }
    }

    // O(MAX(N, M)) memory
    var newChildren = []

    var freeIndex = 0
    var freeCount = bFree.length
    var deletedItems = 0

    // Iterate through a and match a node in b
    // O(N) time,
    for (var i = 0 ; i < aChildren.length; i++) {
        var aItem = aChildren[i]
        var itemIndex

        if (aItem.key) {
            if (bKeys.hasOwnProperty(aItem.key)) {
                // Match up the old keys
                itemIndex = bKeys[aItem.key]
                newChildren.push(bChildren[itemIndex])

            } else {
                // Remove old keyed items
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        } else {
            // Match the item in a with the next free item in b
            if (freeIndex < freeCount) {
                itemIndex = bFree[freeIndex++]
                newChildren.push(bChildren[itemIndex])
            } else {
                // There are no free items in b to match with
                // the free items in a, so the extra free nodes
                // are deleted.
                itemIndex = i - deletedItems++
                newChildren.push(null)
            }
        }
    }

    var lastFreeIndex = freeIndex >= bFree.length ?
        bChildren.length :
        bFree[freeIndex]

    // Iterate through b and append any new keys
    // O(M) time
    for (var j = 0; j < bChildren.length; j++) {
        var newItem = bChildren[j]

        if (newItem.key) {
            if (!aKeys.hasOwnProperty(newItem.key)) {
                // Add any new keyed items
                // We are adding new items to the end and then sorting them
                // in place. In future we should insert new items in place.
                newChildren.push(newItem)
            }
        } else if (j >= lastFreeIndex) {
            // Add any leftover non-keyed items
            newChildren.push(newItem)
        }
    }

    var simulate = newChildren.slice()
    var simulateIndex = 0
    var removes = []
    var inserts = []
    var simulateItem

    for (var k = 0; k < bChildren.length;) {
        var wantedItem = bChildren[k]
        simulateItem = simulate[simulateIndex]

        // remove items
        while (simulateItem === null && simulate.length) {
            removes.push(remove(simulate, simulateIndex, null))
            simulateItem = simulate[simulateIndex]
        }

        if (!simulateItem || simulateItem.key !== wantedItem.key) {
            // if we need a key in this position...
            if (wantedItem.key) {
                if (simulateItem && simulateItem.key) {
                    // if an insert doesn't put this key in place, it needs to move
                    if (bKeys[simulateItem.key] !== k + 1) {
                        removes.push(remove(simulate, simulateIndex, simulateItem.key))
                        simulateItem = simulate[simulateIndex]
                        // if the remove didn't put the wanted item in place, we need to insert it
                        if (!simulateItem || simulateItem.key !== wantedItem.key) {
                            inserts.push({key: wantedItem.key, to: k})
                        }
                        // items are matching, so skip ahead
                        else {
                            simulateIndex++
                        }
                    }
                    else {
                        inserts.push({key: wantedItem.key, to: k})
                    }
                }
                else {
                    inserts.push({key: wantedItem.key, to: k})
                }
                k++
            }
            // a key in simulate has no matching wanted key, remove it
            else if (simulateItem && simulateItem.key) {
                removes.push(remove(simulate, simulateIndex, simulateItem.key))
            }
        }
        else {
            simulateIndex++
            k++
        }
    }

    // remove all the remaining nodes from simulate
    while(simulateIndex < simulate.length) {
        simulateItem = simulate[simulateIndex]
        removes.push(remove(simulate, simulateIndex, simulateItem && simulateItem.key))
    }

    // If the only moves we have are deletes then we can just
    // let the delete patch remove these items.
    if (removes.length === deletedItems && !inserts.length) {
        return {
            children: newChildren,
            moves: null
        }
    }

    return {
        children: newChildren,
        moves: {
            removes: removes,
            inserts: inserts
        }
    }
}

function remove(arr, index, key) {
    arr.splice(index, 1)

    return {
        from: index,
        key: key
    }
}

function keyIndex(children) {
    var keys = {}
    var free = []
    var length = children.length

    for (var i = 0; i < length; i++) {
        var child = children[i]

        if (child.key) {
            keys[child.key] = i
        } else {
            free.push(i)
        }
    }

    return {
        keys: keys,     // A hash of key name to index
        free: free      // An array of unkeyed item indices
    }
}

function appendPatch(apply, patch) {
    if (apply) {
        if (isArray(apply)) {
            apply.push(patch)
        } else {
            apply = [apply, patch]
        }

        return apply
    } else {
        return patch
    }
}

},{"../vnode/handle-thunk":17,"../vnode/is-thunk":18,"../vnode/is-vnode":20,"../vnode/is-vtext":21,"../vnode/is-widget":22,"../vnode/vpatch":25,"./diff-props":27,"x-is-array":29}],29:[function(require,module,exports){
var nativeIsArray = Array.isArray
var toString = Object.prototype.toString

module.exports = nativeIsArray || isArray

function isArray(obj) {
    return toString.call(obj) === "[object Array]"
}

},{}],30:[function(require,module,exports){
'use strict';

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

Object.defineProperty(exports, '__esModule', {
	value: true
});

var _viewsMainView = require('./views/MainView');

var _viewsMainView2 = _interopRequireDefault(_viewsMainView);

function moduleFactory(opts, pubsub) {

	var MODTYPE = {
		'default': _viewsMainView2['default']
	};

	// Obtenemos los atributos datas del módulo
	var datas = opts.el.data();

	// Si viene el canal PUBSUB lo incluímos
	if (pubsub) opts.pubsub = pubsub;

	// Devolvemos la instancia
	if (!datas.theme) {
		return new MODTYPE['default'](opts);
	}

	// Si tenemos que devolver una instancia de una vista de forma dinámica
	return MODTYPE[datas.theme.toLowerCase()] ? new (MODTYPE[datas.theme.toLowerCase()])(opts) : new MODTYPE['default'](opts);
}

exports['default'] = moduleFactory;
module.exports = exports['default'];

},{"./views/MainView":31,"babel-runtime/helpers/interop-require-default":1}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
	value: true
});

var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var createElement = require('virtual-dom/create-element');
var parser = require('vdom-parser');

var MainView = Backbone.View.extend({

	pubsub: _.extend({}, Backbone.Events),

	initialize: function initialize(opts) {
		var _this = this;

		if (opts) {
			_.extend(this, opts);
		}
		this.preRender();
		var count = 0;
		var interval = setInterval(function () {
			if (count > 10) {
				clearInterval(interval);
			}
			_this.render('/minutoaminuto?page=' + ++count);
		}, 5000);
	},

	preRender: function preRender() {
		this.mainNode = this.$el[0];
	},

	render: function render(url) {
		$.get(url).then(this.patchContent.bind(this));
		return this;
	},
	patchContent: function patchContent(data) {
		var newNode = this.mainNode.cloneNode();
		console.log(newNode);
		newNode.innerHTML = data;
		var newNodeVDOM = parser(newNode);

		this.mainNodeVDOM = parser(this.mainNode);
		var patches = diff(this.mainNodeVDOM, newNodeVDOM);
		console.log(patches);

		this.mainNode = patch(this.mainNode, patches);
	}
});

exports['default'] = MainView;
module.exports = exports['default'];

},{"vdom-parser":4,"virtual-dom/create-element":7,"virtual-dom/diff":8,"virtual-dom/patch":10}]},{},[30])(30)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYmFiZWwtcnVudGltZS9oZWxwZXJzL2ludGVyb3AtcmVxdWlyZS1kZWZhdWx0LmpzIiwibm9kZV9tb2R1bGVzL2Jyb3dzZXItcmVzb2x2ZS9lbXB0eS5qcyIsIm5vZGVfbW9kdWxlcy9nbG9iYWwvZG9jdW1lbnQuanMiLCJub2RlX21vZHVsZXMvdmRvbS1wYXJzZXIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvdmRvbS1wYXJzZXIvbmFtZXNwYWNlLW1hcC5qcyIsIm5vZGVfbW9kdWxlcy92ZG9tLXBhcnNlci9wcm9wZXJ0eS1tYXAuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vY3JlYXRlLWVsZW1lbnQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vZGlmZi5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS9ub2RlX21vZHVsZXMvaXMtb2JqZWN0L2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3BhdGNoLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vYXBwbHktcHJvcGVydGllcy5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vZG9tLWluZGV4LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zkb20vcGF0Y2gtb3AuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdmRvbS9wYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92ZG9tL3VwZGF0ZS13aWRnZXQuanMiLCJub2RlX21vZHVsZXMvdmlydHVhbC1kb20vdm5vZGUvaGFuZGxlLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXRodW5rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZob29rLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXZ0ZXh0LmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL2lzLXdpZGdldC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92ZXJzaW9uLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3Zub2RlLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Zub2RlL3ZwYXRjaC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92bm9kZS92dGV4dC5qcyIsIm5vZGVfbW9kdWxlcy92aXJ0dWFsLWRvbS92dHJlZS9kaWZmLXByb3BzLmpzIiwibm9kZV9tb2R1bGVzL3ZpcnR1YWwtZG9tL3Z0cmVlL2RpZmYuanMiLCJub2RlX21vZHVsZXMveC1pcy1hcnJheS9pbmRleC5qcyIsIkM6L1VzZXJzL2ltZzc0MjU5L0Rlc2t0b3AvYTNwcm9qZWN0cy90ZXN0VmlydHVhbERpZmYvc3JjL3Zkb21fZGlmZi5qcyIsIkM6L1VzZXJzL2ltZzc0MjU5L0Rlc2t0b3AvYTNwcm9qZWN0cy90ZXN0VmlydHVhbERpZmYvc3JjL3ZpZXdzL01haW5WaWV3LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBOzs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6VEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBOztBQ0hBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM2FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7Ozs2QkNSc0Isa0JBQWtCOzs7O0FBRXhDLFNBQVMsYUFBYSxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUM7O0FBRW5DLEtBQUksT0FBTyxHQUFHO0FBQ2IsV0FBUyw0QkFBWTtFQUNyQixDQUFDOzs7QUFHRixLQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDOzs7QUFHM0IsS0FBRyxNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7OztBQUdoQyxLQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBQztBQUNmLFNBQU8sSUFBSSxPQUFPLENBQUUsU0FBUyxDQUFFLENBQUMsSUFBSSxDQUFDLENBQUM7RUFDdEM7OztBQUdELFFBQU8sQUFBRSxPQUFPLENBQUUsS0FBSyxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsQ0FBRSxHQUM1QyxLQUFJLE9BQU8sQ0FBRSxLQUFLLENBQUMsS0FBSyxDQUFDLFdBQVcsRUFBRSxFQUFFLENBQUMsSUFBSSxDQUFDLEdBQzlDLElBQUksT0FBTyxDQUFFLFNBQVMsQ0FBRSxDQUFDLElBQUksQ0FBQyxDQUFDO0NBQ2hDOztxQkFFYyxhQUFhOzs7Ozs7Ozs7O0FDeEI1QixJQUFJLElBQUksR0FBRyxPQUFPLENBQUMsa0JBQWtCLENBQUMsQ0FBQztBQUN2QyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUMsQ0FBQztBQUN6QyxJQUFJLGFBQWEsR0FBRyxPQUFPLENBQUMsNEJBQTRCLENBQUMsQ0FBQztBQUMxRCxJQUFJLE1BQU0sR0FBRyxPQUFPLENBQUMsYUFBYSxDQUFDLENBQUM7O0FBRXBDLElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDOztBQUVuQyxPQUFNLEVBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLE1BQU0sQ0FBQzs7QUFFeEMsV0FBVSxFQUFFLG9CQUFTLElBQUksRUFBQzs7O0FBQ3pCLE1BQUcsSUFBSSxFQUFDO0FBQUUsSUFBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLENBQUM7R0FBRTtBQUNqQyxNQUFJLENBQUMsU0FBUyxFQUFFLENBQUM7QUFDakIsTUFBSSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2QsTUFBSSxRQUFRLEdBQUcsV0FBVyxDQUFDLFlBQUk7QUFDOUIsT0FBRyxLQUFLLEdBQUMsRUFBRSxFQUFDO0FBQUUsaUJBQWEsQ0FBQyxRQUFRLENBQUMsQ0FBQztJQUFFO0FBQ3hDLFNBQUssTUFBTSxDQUFDLHNCQUFzQixHQUFFLEVBQUUsS0FBSyxBQUFDLENBQUMsQ0FBQztHQUM5QyxFQUFDLElBQUksQ0FBQyxDQUFDO0VBQ1I7O0FBRUQsVUFBUyxFQUFFLHFCQUFVO0FBQ3BCLE1BQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQztFQUU1Qjs7QUFFRCxPQUFNLEVBQUUsZ0JBQVMsR0FBRyxFQUFDO0FBQ3BCLEdBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFFLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFFLENBQUM7QUFDaEQsU0FBTyxJQUFJLENBQUM7RUFDWjtBQUNELGFBQVksRUFBRSxzQkFBUyxJQUFJLEVBQUM7QUFDM0IsTUFBSSxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsQ0FBQztBQUN4QyxTQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBQ3JCLFNBQU8sQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBQ3pCLE1BQUksV0FBVyxHQUFHLE1BQU0sQ0FBRSxPQUFPLENBQUUsQ0FBQzs7QUFFcEMsTUFBSSxDQUFDLFlBQVksR0FBRyxNQUFNLENBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBRSxDQUFDO0FBQzVDLE1BQUksT0FBTyxHQUFHLElBQUksQ0FBRSxJQUFJLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBRSxDQUFDO0FBQ3JELFNBQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7O0FBRXJCLE1BQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFFLENBQUM7RUFDaEQ7Q0FDRCxDQUFDLENBQUM7O3FCQUVZLFFBQVEiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gZnVuY3Rpb24gKG9iaikge1xuICByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDoge1xuICAgIFwiZGVmYXVsdFwiOiBvYmpcbiAgfTtcbn07XG5cbmV4cG9ydHMuX19lc01vZHVsZSA9IHRydWU7IixudWxsLCJ2YXIgdG9wTGV2ZWwgPSB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6XG4gICAgdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cgOiB7fVxudmFyIG1pbkRvYyA9IHJlcXVpcmUoJ21pbi1kb2N1bWVudCcpO1xuXG5pZiAodHlwZW9mIGRvY3VtZW50ICE9PSAndW5kZWZpbmVkJykge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZG9jdW1lbnQ7XG59IGVsc2Uge1xuICAgIHZhciBkb2NjeSA9IHRvcExldmVsWydfX0dMT0JBTF9ET0NVTUVOVF9DQUNIRUA0J107XG5cbiAgICBpZiAoIWRvY2N5KSB7XG4gICAgICAgIGRvY2N5ID0gdG9wTGV2ZWxbJ19fR0xPQkFMX0RPQ1VNRU5UX0NBQ0hFQDQnXSA9IG1pbkRvYztcbiAgICB9XG5cbiAgICBtb2R1bGUuZXhwb3J0cyA9IGRvY2N5O1xufVxuIiwiXG4vKipcbiAqIGluZGV4LmpzXG4gKlxuICogQSBjbGllbnQtc2lkZSBET00gdG8gdmRvbSBwYXJzZXIgYmFzZWQgb24gRE9NUGFyc2VyIEFQSVxuICovXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFZOb2RlID0gcmVxdWlyZSgndmlydHVhbC1kb20vdm5vZGUvdm5vZGUnKTtcbnZhciBWVGV4dCA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL3Zub2RlL3Z0ZXh0Jyk7XG52YXIgZG9tUGFyc2VyO1xuXG52YXIgcHJvcGVydHlNYXAgPSByZXF1aXJlKCcuL3Byb3BlcnR5LW1hcCcpO1xudmFyIG5hbWVzcGFjZU1hcCA9IHJlcXVpcmUoJy4vbmFtZXNwYWNlLW1hcCcpO1xuXG52YXIgSFRNTF9OQU1FU1BBQ0UgPSAnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VyO1xuXG4vKipcbiAqIERPTS9odG1sIHN0cmluZyB0byB2ZG9tIHBhcnNlclxuICpcbiAqIEBwYXJhbSAgIE1peGVkICAgZWwgICAgRE9NIGVsZW1lbnQgb3IgaHRtbCBzdHJpbmdcbiAqIEBwYXJhbSAgIFN0cmluZyAgYXR0ciAgQXR0cmlidXRlIG5hbWUgdGhhdCBjb250YWlucyB2ZG9tIGtleVxuICogQHJldHVybiAgT2JqZWN0ICAgICAgICBWTm9kZSBvciBWVGV4dFxuICovXG5mdW5jdGlvbiBwYXJzZXIoZWwsIGF0dHIpIHtcblx0Ly8gZW1wdHkgaW5wdXQgZmFsbGJhY2sgdG8gZW1wdHkgdGV4dCBub2RlXG5cdGlmICghZWwpIHtcblx0XHRyZXR1cm4gY3JlYXRlTm9kZShkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJykpO1xuXHR9XG5cblx0aWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcblx0XHRpZiAoICEoJ0RPTVBhcnNlcicgaW4gd2luZG93KSApIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRE9NUGFyc2VyIGlzIG5vdCBhdmFpbGFibGUsIHNvIHBhcnNpbmcgc3RyaW5nIHRvIERPTSBub2RlIGlzIG5vdCBwb3NzaWJsZS4nKTtcblx0XHR9XG5cdFx0ZG9tUGFyc2VyID0gZG9tUGFyc2VyIHx8IG5ldyBET01QYXJzZXIoKTtcblx0XHR2YXIgZG9jID0gZG9tUGFyc2VyLnBhcnNlRnJvbVN0cmluZyhlbCwgJ3RleHQvaHRtbCcpO1xuXG5cdFx0Ly8gbW9zdCB0YWdzIGRlZmF1bHQgdG8gYm9keVxuXHRcdGlmIChkb2MuYm9keS5maXJzdENoaWxkKSB7XG5cdFx0XHRlbCA9IGRvYy5nZXRFbGVtZW50c0J5VGFnTmFtZSgnYm9keScpWzBdLmZpcnN0Q2hpbGQ7XG5cblx0XHQvLyBzb21lIHRhZ3MsIGxpa2Ugc2NyaXB0IGFuZCBzdHlsZSwgZGVmYXVsdCB0byBoZWFkXG5cdFx0fSBlbHNlIGlmIChkb2MuaGVhZC5maXJzdENoaWxkICYmIChkb2MuaGVhZC5maXJzdENoaWxkLnRhZ05hbWUgIT09ICdUSVRMRScgfHwgZG9jLnRpdGxlKSkge1xuXHRcdFx0ZWwgPSBkb2MuaGVhZC5maXJzdENoaWxkO1xuXG5cdFx0Ly8gc3BlY2lhbCBjYXNlIGZvciBodG1sIGNvbW1lbnQsIGNkYXRhLCBkb2N0eXBlXG5cdFx0fSBlbHNlIGlmIChkb2MuZmlyc3RDaGlsZCAmJiBkb2MuZmlyc3RDaGlsZC50YWdOYW1lICE9PSAnSFRNTCcpIHtcblx0XHRcdGVsID0gZG9jLmZpcnN0Q2hpbGQ7XG5cblx0XHQvLyBvdGhlciBlbGVtZW50LCBzdWNoIGFzIHdoaXRlc3BhY2UsIG9yIGh0bWwvYm9keS9oZWFkIHRhZywgZmFsbGJhY2sgdG8gZW1wdHkgdGV4dCBub2RlXG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpO1xuXHRcdH1cblx0fVxuXG5cdGlmICh0eXBlb2YgZWwgIT09ICdvYmplY3QnIHx8ICFlbCB8fCAhZWwubm9kZVR5cGUpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ludmFsaWQgZG9tIG5vZGUnLCBlbCk7XG5cdH1cblxuXHRyZXR1cm4gY3JlYXRlTm9kZShlbCwgYXR0cik7XG59XG5cbi8qKlxuICogQ3JlYXRlIHZkb20gZnJvbSBkb20gbm9kZVxuICpcbiAqIEBwYXJhbSAgIE9iamVjdCAgZWwgICAgRE9NIGVsZW1lbnRcbiAqIEBwYXJhbSAgIFN0cmluZyAgYXR0ciAgQXR0cmlidXRlIG5hbWUgdGhhdCBjb250YWlucyB2ZG9tIGtleVxuICogQHJldHVybiAgT2JqZWN0ICAgICAgICBWTm9kZSBvciBWVGV4dFxuICovXG5mdW5jdGlvbiBjcmVhdGVOb2RlKGVsLCBhdHRyKSB7XG5cdC8vIGh0bWwgY29tbWVudCBpcyBub3QgY3VycmVudGx5IHN1cHBvcnRlZCBieSB2aXJ0dWFsLWRvbVxuXHRpZiAoZWwubm9kZVR5cGUgPT09IDMpIHtcblx0XHRyZXR1cm4gY3JlYXRlVmlydHVhbFRleHROb2RlKGVsKTtcblxuXHQvLyBjZGF0YSBvciBkb2N0eXBlIGlzIG5vdCBjdXJyZW50bHkgc3VwcG9ydGVkIGJ5IHZpcnR1YWwtZG9tXG5cdH0gZWxzZSBpZiAoZWwubm9kZVR5cGUgPT09IDEgfHwgZWwubm9kZVR5cGUgPT09IDkpIHtcblx0XHRyZXR1cm4gY3JlYXRlVmlydHVhbERvbU5vZGUoZWwsIGF0dHIpO1xuXHR9XG5cblx0Ly8gZGVmYXVsdCB0byBlbXB0eSB0ZXh0IG5vZGVcblx0cmV0dXJuIG5ldyBWVGV4dCgnJyk7XG59XG5cbi8qKlxuICogQ3JlYXRlIHZ0ZXh0IGZyb20gZG9tIG5vZGVcbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGVsICBUZXh0IG5vZGVcbiAqIEByZXR1cm4gIE9iamVjdCAgICAgIFZUZXh0XG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVZpcnR1YWxUZXh0Tm9kZShlbCkge1xuXHRyZXR1cm4gbmV3IFZUZXh0KGVsLm5vZGVWYWx1ZSk7XG59XG5cbi8qKlxuICogQ3JlYXRlIHZub2RlIGZyb20gZG9tIG5vZGVcbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGVsICAgIERPTSBlbGVtZW50XG4gKiBAcGFyYW0gICBTdHJpbmcgIGF0dHIgIEF0dHJpYnV0ZSBuYW1lIHRoYXQgY29udGFpbnMgdmRvbSBrZXlcbiAqIEByZXR1cm4gIE9iamVjdCAgICAgICAgVk5vZGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVmlydHVhbERvbU5vZGUoZWwsIGF0dHIpIHtcblx0dmFyIG5zID0gZWwubmFtZXNwYWNlVVJJICE9PSBIVE1MX05BTUVTUEFDRSA/IGVsLm5hbWVzcGFjZVVSSSA6IG51bGw7XG5cdHZhciBrZXkgPSBhdHRyICYmIGVsLmdldEF0dHJpYnV0ZShhdHRyKSA/IGVsLmdldEF0dHJpYnV0ZShhdHRyKSA6IG51bGw7XG5cblx0cmV0dXJuIG5ldyBWTm9kZShcblx0XHRlbC50YWdOYW1lXG5cdFx0LCBjcmVhdGVQcm9wZXJ0aWVzKGVsKVxuXHRcdCwgY3JlYXRlQ2hpbGRyZW4oZWwsIGF0dHIpXG5cdFx0LCBrZXlcblx0XHQsIG5zXG5cdCk7XG59XG5cbi8qKlxuICogUmVjdXJzaXZlbHkgY3JlYXRlIHZkb21cbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGVsICAgIFBhcmVudCBlbGVtZW50XG4gKiBAcGFyYW0gICBTdHJpbmcgIGF0dHIgIEF0dHJpYnV0ZSBuYW1lIHRoYXQgY29udGFpbnMgdmRvbSBrZXlcbiAqIEByZXR1cm4gIEFycmF5ICAgICAgICAgQ2hpbGQgdm5vZGUgb3IgdnRleHRcbiAqL1xuZnVuY3Rpb24gY3JlYXRlQ2hpbGRyZW4oZWwsIGF0dHIpIHtcblx0dmFyIGNoaWxkcmVuID0gW107XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgZWwuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuXHRcdGNoaWxkcmVuLnB1c2goY3JlYXRlTm9kZShlbC5jaGlsZE5vZGVzW2ldLCBhdHRyKSk7XG5cdH07XG5cblx0cmV0dXJuIGNoaWxkcmVuO1xufVxuXG4vKipcbiAqIENyZWF0ZSBwcm9wZXJ0aWVzIGZyb20gZG9tIG5vZGVcbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGVsICBET00gZWxlbWVudFxuICogQHJldHVybiAgT2JqZWN0ICAgICAgTm9kZSBwcm9wZXJ0aWVzIGFuZCBhdHRyaWJ1dGVzXG4gKi9cbmZ1bmN0aW9uIGNyZWF0ZVByb3BlcnRpZXMoZWwpIHtcblx0dmFyIHByb3BlcnRpZXMgPSB7fTtcblxuXHRpZiAoIWVsLmhhc0F0dHJpYnV0ZXMoKSkge1xuXHRcdHJldHVybiBwcm9wZXJ0aWVzO1xuXHR9XG5cblx0dmFyIG5zO1xuXHRpZiAoZWwubmFtZXNwYWNlVVJJICYmIGVsLm5hbWVzcGFjZVVSSSAhPT0gSFRNTF9OQU1FU1BBQ0UpIHtcblx0XHRucyA9IGVsLm5hbWVzcGFjZVVSSTtcblx0fVxuXG5cdHZhciBhdHRyO1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IGVsLmF0dHJpYnV0ZXMubGVuZ3RoOyBpKyspIHtcblx0XHQvLyB1c2UgYnVpbHQgaW4gY3NzIHN0eWxlIHBhcnNpbmdcblx0XHRpZihlbC5hdHRyaWJ1dGVzW2ldLm5hbWUgPT0gJ3N0eWxlJyl7XG5cdFx0XHRhdHRyID0gY3JlYXRlU3R5bGVQcm9wZXJ0eShlbCk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKG5zKSB7XG5cdFx0XHRhdHRyID0gY3JlYXRlUHJvcGVydHlOUyhlbC5hdHRyaWJ1dGVzW2ldKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXR0ciA9IGNyZWF0ZVByb3BlcnR5KGVsLmF0dHJpYnV0ZXNbaV0pO1xuXHRcdH1cblxuXHRcdC8vIHNwZWNpYWwgY2FzZSwgbmFtZXNwYWNlZCBhdHRyaWJ1dGUsIHVzZSBwcm9wZXJ0aWVzLmZvb2JhclxuXHRcdGlmIChhdHRyLm5zKSB7XG5cdFx0XHRwcm9wZXJ0aWVzW2F0dHIubmFtZV0gPSB7XG5cdFx0XHRcdG5hbWVzcGFjZTogYXR0ci5uc1xuXHRcdFx0XHQsIHZhbHVlOiBhdHRyLnZhbHVlXG5cdFx0XHR9O1xuXG5cdFx0Ly8gc3BlY2lhbCBjYXNlLCB1c2UgcHJvcGVydGllcy5hdHRyaWJ1dGVzLmZvb2JhclxuXHRcdH0gZWxzZSBpZiAoYXR0ci5pc0F0dHIpIHtcblx0XHRcdC8vIGluaXQgYXR0cmlidXRlcyBvYmplY3Qgb25seSB3aGVuIG5lY2Vzc2FyeVxuXHRcdFx0aWYgKCFwcm9wZXJ0aWVzLmF0dHJpYnV0ZXMpIHtcblx0XHRcdFx0cHJvcGVydGllcy5hdHRyaWJ1dGVzID0ge31cblx0XHRcdH1cblx0XHRcdHByb3BlcnRpZXMuYXR0cmlidXRlc1thdHRyLm5hbWVdID0gYXR0ci52YWx1ZTtcblxuXHRcdC8vIGRlZmF1bHQgY2FzZSwgdXNlIHByb3BlcnRpZXMuZm9vYmFyXG5cdFx0fSBlbHNlIHtcblx0XHRcdHByb3BlcnRpZXNbYXR0ci5uYW1lXSA9IGF0dHIudmFsdWU7XG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiBwcm9wZXJ0aWVzO1xufVxuXG4vKipcbiAqIENyZWF0ZSBwcm9wZXJ0eSBmcm9tIGRvbSBhdHRyaWJ1dGVcbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGF0dHIgIERPTSBhdHRyaWJ1dGVcbiAqIEByZXR1cm4gIE9iamVjdCAgICAgICAgTm9ybWFsaXplZCBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvcGVydHkoYXR0cikge1xuXHR2YXIgbmFtZSwgdmFsdWUsIGlzQXR0cjtcblxuXHQvLyB1c2luZyBhIG1hcCB0byBmaW5kIHRoZSBjb3JyZWN0IGNhc2Ugb2YgcHJvcGVydHkgbmFtZVxuXHRpZiAocHJvcGVydHlNYXBbYXR0ci5uYW1lXSkge1xuXHRcdG5hbWUgPSBwcm9wZXJ0eU1hcFthdHRyLm5hbWVdO1xuXHR9IGVsc2Uge1xuXHRcdG5hbWUgPSBhdHRyLm5hbWU7XG5cdH1cblx0Ly8gc3BlY2lhbCBjYXNlcyBmb3IgZGF0YSBhdHRyaWJ1dGUsIHdlIGRlZmF1bHQgdG8gcHJvcGVydGllcy5hdHRyaWJ1dGVzLmRhdGFcblx0aWYgKG5hbWUuaW5kZXhPZignZGF0YS0nKSA9PT0gMCB8fCBuYW1lLmluZGV4T2YoJ2FyaWEtJykgPT09IDApIHtcblx0XHR2YWx1ZSA9IGF0dHIudmFsdWU7XG5cdFx0aXNBdHRyID0gdHJ1ZTtcblx0fSBlbHNlIHtcblx0XHR2YWx1ZSA9IGF0dHIudmFsdWU7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdG5hbWU6IG5hbWVcblx0XHQsIHZhbHVlOiB2YWx1ZVxuXHRcdCwgaXNBdHRyOiBpc0F0dHIgfHwgZmFsc2Vcblx0fTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgbmFtZXNwYWNlZCBwcm9wZXJ0eSBmcm9tIGRvbSBhdHRyaWJ1dGVcbiAqXG4gKiBAcGFyYW0gICBPYmplY3QgIGF0dHIgIERPTSBhdHRyaWJ1dGVcbiAqIEByZXR1cm4gIE9iamVjdCAgICAgICAgTm9ybWFsaXplZCBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlUHJvcGVydHlOUyhhdHRyKSB7XG5cdHZhciBuYW1lLCB2YWx1ZTtcblxuXHRyZXR1cm4ge1xuXHRcdG5hbWU6IGF0dHIubmFtZVxuXHRcdCwgdmFsdWU6IGF0dHIudmFsdWVcblx0XHQsIG5zOiBuYW1lc3BhY2VNYXBbYXR0ci5uYW1lXSB8fCAnJ1xuXHR9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBzdHlsZSBwcm9wZXJ0eSBmcm9tIGRvbSBub2RlXG4gKlxuICogQHBhcmFtICAgT2JqZWN0ICBlbCAgRE9NIG5vZGVcbiAqIEByZXR1cm4gIE9iamVjdCAgICAgICAgTm9ybWFsaXplZCBhdHRyaWJ1dGVcbiAqL1xuZnVuY3Rpb24gY3JlYXRlU3R5bGVQcm9wZXJ0eShlbCkge1xuXHR2YXIgc3R5bGUgPSBlbC5zdHlsZTtcblx0dmFyIG91dHB1dCA9IHt9O1xuXHRmb3IgKHZhciBpID0gMDsgaSA8IHN0eWxlLmxlbmd0aDsgKytpKSB7XG5cdFx0dmFyIGl0ZW0gPSBzdHlsZS5pdGVtKGkpO1xuXHRcdG91dHB1dFtpdGVtXSA9IHN0eWxlW2l0ZW1dO1xuXHRcdC8vIGhhY2sgdG8gd29ya2Fyb3VuZCBicm93c2VyIGluY29uc2lzdGVuY3kgd2l0aCB1cmwoKVxuXHRcdGlmIChvdXRwdXRbaXRlbV0uaW5kZXhPZigndXJsJykgPiAtMSkge1xuXHRcdFx0b3V0cHV0W2l0ZW1dID0gb3V0cHV0W2l0ZW1dLnJlcGxhY2UoL1xcXCIvZywgJycpXG5cdFx0fVxuXHR9XG5cdHJldHVybiB7IG5hbWU6ICdzdHlsZScsIHZhbHVlOiBvdXRwdXQgfTtcbn1cbiIsIlxuLyoqXG4gKiBuYW1lc3BhY2UtbWFwLmpzXG4gKlxuICogTmVjZXNzYXJ5IHRvIG1hcCBzdmcgYXR0cmlidXRlcyBiYWNrIHRvIHRoZWlyIG5hbWVzcGFjZVxuICovXG5cbid1c2Ugc3RyaWN0JztcblxuLy8gZXh0cmFjdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL01hdHQtRXNjaC92aXJ0dWFsLWRvbS9ibG9iL21hc3Rlci92aXJ0dWFsLWh5cGVyc2NyaXB0L3N2Zy1hdHRyaWJ1dGUtbmFtZXNwYWNlLmpzXG52YXIgREVGQVVMVF9OQU1FU1BBQ0UgPSBudWxsO1xudmFyIEVWX05BTUVTUEFDRSA9ICdodHRwOi8vd3d3LnczLm9yZy8yMDAxL3htbC1ldmVudHMnO1xudmFyIFhMSU5LX05BTUVTUEFDRSA9ICdodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rJztcbnZhciBYTUxfTkFNRVNQQUNFID0gJ2h0dHA6Ly93d3cudzMub3JnL1hNTC8xOTk4L25hbWVzcGFjZSc7XG5cbnZhciBuYW1lc3BhY2VzID0ge1xuXHQnYWJvdXQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdhY2NlbnQtaGVpZ2h0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYWNjdW11bGF0ZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2FkZGl0aXZlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYWxpZ25tZW50LWJhc2VsaW5lJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYWxwaGFiZXRpYyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2FtcGxpdHVkZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2FyYWJpYy1mb3JtJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYXNjZW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYXR0cmlidXRlTmFtZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2F0dHJpYnV0ZVR5cGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdhemltdXRoJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYmFuZHdpZHRoJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYmFzZUZyZXF1ZW5jeSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2Jhc2VQcm9maWxlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYmFzZWxpbmUtc2hpZnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdiYm94JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYmVnaW4nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdiaWFzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnYnknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjYWxjTW9kZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2NhcC1oZWlnaHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjbGFzcyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2NsaXAnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjbGlwLXBhdGgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjbGlwLXJ1bGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjbGlwUGF0aFVuaXRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnY29sb3InOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjb2xvci1pbnRlcnBvbGF0aW9uJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnY29sb3ItcHJvZmlsZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2NvbG9yLXJlbmRlcmluZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2NvbnRlbnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjb250ZW50U2NyaXB0VHlwZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2NvbnRlbnRTdHlsZVR5cGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjdXJzb3InOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdjeCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2N5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2RhdGF0eXBlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZGVmYXVsdEFjdGlvbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2Rlc2NlbnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdkaWZmdXNlQ29uc3RhbnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdkaXJlY3Rpb24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdkaXNwbGF5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZGl2aXNvcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2RvbWluYW50LWJhc2VsaW5lJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZHVyJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZHgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdkeSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2VkZ2VNb2RlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZWRpdGFibGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdlbGV2YXRpb24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdlbmFibGUtYmFja2dyb3VuZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2VuZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2V2OmV2ZW50JzogRVZfTkFNRVNQQUNFXG5cdCwgJ2V2ZW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZXhwb25lbnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdleHRlcm5hbFJlc291cmNlc1JlcXVpcmVkJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZmlsbCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZpbGwtb3BhY2l0eSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZpbGwtcnVsZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZpbHRlcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZpbHRlclJlcyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZpbHRlclVuaXRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZmxvb2QtY29sb3InOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmbG9vZC1vcGFjaXR5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZm9jdXNIaWdobGlnaHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmb2N1c2FibGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmb250LWZhbWlseSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZvbnQtc2l6ZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2ZvbnQtc2l6ZS1hZGp1c3QnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmb250LXN0cmV0Y2gnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmb250LXN0eWxlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZm9udC12YXJpYW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZm9udC13ZWlnaHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmb3JtYXQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmcm9tJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZngnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdmeSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2cxJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZzInOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdnbHlwaC1uYW1lJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZ2x5cGgtb3JpZW50YXRpb24taG9yaXpvbnRhbCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2dseXBoLW9yaWVudGF0aW9uLXZlcnRpY2FsJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnZ2x5cGhSZWYnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdncmFkaWVudFRyYW5zZm9ybSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2dyYWRpZW50VW5pdHMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdoYW5kbGVyJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnaGFuZ2luZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2hlaWdodCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2hvcml6LWFkdi14JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnaG9yaXotb3JpZ2luLXgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdob3Jpei1vcmlnaW4teSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2lkJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnaWRlb2dyYXBoaWMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdpbWFnZS1yZW5kZXJpbmcnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdpbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2luMic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2luaXRpYWxWaXNpYmlsaXR5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnaW50ZXJjZXB0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnayc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2sxJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnazInOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdrMyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2s0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAna2VybmVsTWF0cml4JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAna2VybmVsVW5pdExlbmd0aCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2tlcm5pbmcnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdrZXlQb2ludHMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdrZXlTcGxpbmVzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAna2V5VGltZXMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdsYW5nJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbGVuZ3RoQWRqdXN0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbGV0dGVyLXNwYWNpbmcnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdsaWdodGluZy1jb2xvcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ2xpbWl0aW5nQ29uZUFuZ2xlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbG9jYWwnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdtYXJrZXItZW5kJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbWFya2VyLW1pZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21hcmtlci1zdGFydCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21hcmtlckhlaWdodCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21hcmtlclVuaXRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbWFya2VyV2lkdGgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdtYXNrJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbWFza0NvbnRlbnRVbml0cyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21hc2tVbml0cyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21hdGhlbWF0aWNhbCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21heCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21lZGlhJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbWVkaWFDaGFyYWN0ZXJFbmNvZGluZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21lZGlhQ29udGVudEVuY29kaW5ncyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21lZGlhU2l6ZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21lZGlhVGltZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21ldGhvZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21pbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ21vZGUnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYW1lJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbmF2LWRvd24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYXYtZG93bi1sZWZ0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbmF2LWRvd24tcmlnaHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYXYtbGVmdCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ25hdi1uZXh0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnbmF2LXByZXYnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYXYtcmlnaHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYXYtdXAnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICduYXYtdXAtbGVmdCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ25hdi11cC1yaWdodCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ251bU9jdGF2ZXMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdvYnNlcnZlcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ29mZnNldCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ29wYWNpdHknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdvcGVyYXRvcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ29yZGVyJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnb3JpZW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnb3JpZW50YXRpb24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdvcmlnaW4nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdvdmVyZmxvdyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ292ZXJsYXknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdvdmVybGluZS1wb3NpdGlvbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ292ZXJsaW5lLXRoaWNrbmVzcyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Bhbm9zZS0xJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncGF0aCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3BhdGhMZW5ndGgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdwYXR0ZXJuQ29udGVudFVuaXRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncGF0dGVyblRyYW5zZm9ybSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3BhdHRlcm5Vbml0cyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3BoYXNlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncGxheWJhY2tPcmRlcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3BvaW50ZXItZXZlbnRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncG9pbnRzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncG9pbnRzQXRYJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncG9pbnRzQXRZJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncG9pbnRzQXRaJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncHJlc2VydmVBbHBoYSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3ByZXNlcnZlQXNwZWN0UmF0aW8nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdwcmltaXRpdmVVbml0cyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Byb3BhZ2F0ZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Byb3BlcnR5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3JhZGl1cyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3JlZlgnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyZWZZJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncmVsJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncmVuZGVyaW5nLWludGVudCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3JlcGVhdENvdW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncmVwZWF0RHVyJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncmVxdWlyZWRFeHRlbnNpb25zJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncmVxdWlyZWRGZWF0dXJlcyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3JlcXVpcmVkRm9udHMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyZXF1aXJlZEZvcm1hdHMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyZXNvdXJjZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Jlc3RhcnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyZXN1bHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyZXYnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyb2xlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncm90YXRlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAncngnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdyeSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3NjYWxlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc2VlZCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3NoYXBlLXJlbmRlcmluZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Nsb3BlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc25hcHNob3RUaW1lJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3BhY2luZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3NwZWN1bGFyQ29uc3RhbnQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzcGVjdWxhckV4cG9uZW50JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3ByZWFkTWV0aG9kJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3RhcnRPZmZzZXQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzdGREZXZpYXRpb24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzdGVtaCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3N0ZW12JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3RpdGNoVGlsZXMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzdG9wLWNvbG9yJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3RvcC1vcGFjaXR5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3RyaWtldGhyb3VnaC1wb3NpdGlvbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3N0cmlrZXRocm91Z2gtdGhpY2tuZXNzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3RyaW5nJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3Ryb2tlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3Ryb2tlLWRhc2hhcnJheSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3N0cm9rZS1kYXNob2Zmc2V0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3Ryb2tlLWxpbmVjYXAnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzdHJva2UtbGluZWpvaW4nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzdHJva2UtbWl0ZXJsaW1pdCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3N0cm9rZS1vcGFjaXR5JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3Ryb2tlLXdpZHRoJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3VyZmFjZVNjYWxlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3luY0JlaGF2aW9yJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3luY0JlaGF2aW9yRGVmYXVsdCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3N5bmNNYXN0ZXInOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzeW5jVG9sZXJhbmNlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAnc3luY1RvbGVyYW5jZURlZmF1bHQnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICdzeXN0ZW1MYW5ndWFnZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RhYmxlVmFsdWVzJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndGFyZ2V0JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndGFyZ2V0WCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RhcmdldFknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd0ZXh0LWFuY2hvcic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RleHQtZGVjb3JhdGlvbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RleHQtcmVuZGVyaW5nJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndGV4dExlbmd0aCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RpbWVsaW5lQmVnaW4nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd0aXRsZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3RvJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndHJhbnNmb3JtJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndHJhbnNmb3JtQmVoYXZpb3InOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd0eXBlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndHlwZW9mJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndTEnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd1Mic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3VuZGVybGluZS1wb3NpdGlvbic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3VuZGVybGluZS10aGlja25lc3MnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd1bmljb2RlJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndW5pY29kZS1iaWRpJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndW5pY29kZS1yYW5nZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3VuaXRzLXBlci1lbSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3YtYWxwaGFiZXRpYyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3YtaGFuZ2luZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3YtaWRlb2dyYXBoaWMnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd2LW1hdGhlbWF0aWNhbCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3ZhbHVlcyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3ZlcnNpb24nOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd2ZXJ0LWFkdi15JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndmVydC1vcmlnaW4teCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3ZlcnQtb3JpZ2luLXknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd2aWV3Qm94JzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAndmlld1RhcmdldCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3Zpc2liaWxpdHknOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd3aWR0aCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3dpZHRocyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3dvcmQtc3BhY2luZyc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3dyaXRpbmctbW9kZSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3gnOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd4LWhlaWdodCc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3gxJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAneDInOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd4Q2hhbm5lbFNlbGVjdG9yJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAneGxpbms6YWN0dWF0ZSc6IFhMSU5LX05BTUVTUEFDRVxuXHQsICd4bGluazphcmNyb2xlJzogWExJTktfTkFNRVNQQUNFXG5cdCwgJ3hsaW5rOmhyZWYnOiBYTElOS19OQU1FU1BBQ0Vcblx0LCAneGxpbms6cm9sZSc6IFhMSU5LX05BTUVTUEFDRVxuXHQsICd4bGluazpzaG93JzogWExJTktfTkFNRVNQQUNFXG5cdCwgJ3hsaW5rOnRpdGxlJzogWExJTktfTkFNRVNQQUNFXG5cdCwgJ3hsaW5rOnR5cGUnOiBYTElOS19OQU1FU1BBQ0Vcblx0LCAneG1sOmJhc2UnOiBYTUxfTkFNRVNQQUNFXG5cdCwgJ3htbDppZCc6IFhNTF9OQU1FU1BBQ0Vcblx0LCAneG1sOmxhbmcnOiBYTUxfTkFNRVNQQUNFXG5cdCwgJ3htbDpzcGFjZSc6IFhNTF9OQU1FU1BBQ0Vcblx0LCAneSc6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3kxJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAneTInOiBERUZBVUxUX05BTUVTUEFDRVxuXHQsICd5Q2hhbm5lbFNlbGVjdG9yJzogREVGQVVMVF9OQU1FU1BBQ0Vcblx0LCAneic6IERFRkFVTFRfTkFNRVNQQUNFXG5cdCwgJ3pvb21BbmRQYW4nOiBERUZBVUxUX05BTUVTUEFDRVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuYW1lc3BhY2VzO1xuIiwiXG4vKipcbiAqIHByb3BlcnR5LW1hcC5qc1xuICpcbiAqIE5lY2Vzc2FyeSB0byBtYXAgZG9tIGF0dHJpYnV0ZXMgYmFjayB0byB2ZG9tIHByb3BlcnRpZXNcbiAqL1xuXG4ndXNlIHN0cmljdCc7XG5cbi8vIGludmVydCBvZiBodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9odG1sLWF0dHJpYnV0ZXNcbnZhciBwcm9wZXJ0aWVzID0ge1xuXHQnYWJicic6ICdhYmJyJ1xuXHQsICdhY2NlcHQnOiAnYWNjZXB0J1xuXHQsICdhY2NlcHQtY2hhcnNldCc6ICdhY2NlcHRDaGFyc2V0J1xuXHQsICdhY2Nlc3NrZXknOiAnYWNjZXNzS2V5J1xuXHQsICdhY3Rpb24nOiAnYWN0aW9uJ1xuXHQsICdhbGxvd2Z1bGxzY3JlZW4nOiAnYWxsb3dGdWxsU2NyZWVuJ1xuXHQsICdhbGxvd3RyYW5zcGFyZW5jeSc6ICdhbGxvd1RyYW5zcGFyZW5jeSdcblx0LCAnYWx0JzogJ2FsdCdcblx0LCAnYXN5bmMnOiAnYXN5bmMnXG5cdCwgJ2F1dG9jb21wbGV0ZSc6ICdhdXRvQ29tcGxldGUnXG5cdCwgJ2F1dG9mb2N1cyc6ICdhdXRvRm9jdXMnXG5cdCwgJ2F1dG9wbGF5JzogJ2F1dG9QbGF5J1xuXHQsICdjZWxscGFkZGluZyc6ICdjZWxsUGFkZGluZydcblx0LCAnY2VsbHNwYWNpbmcnOiAnY2VsbFNwYWNpbmcnXG5cdCwgJ2NoYWxsZW5nZSc6ICdjaGFsbGVuZ2UnXG5cdCwgJ2NoYXJzZXQnOiAnY2hhcnNldCdcblx0LCAnY2hlY2tlZCc6ICdjaGVja2VkJ1xuXHQsICdjaXRlJzogJ2NpdGUnXG5cdCwgJ2NsYXNzJzogJ2NsYXNzTmFtZSdcblx0LCAnY29scyc6ICdjb2xzJ1xuXHQsICdjb2xzcGFuJzogJ2NvbFNwYW4nXG5cdCwgJ2NvbW1hbmQnOiAnY29tbWFuZCdcblx0LCAnY29udGVudCc6ICdjb250ZW50J1xuXHQsICdjb250ZW50ZWRpdGFibGUnOiAnY29udGVudEVkaXRhYmxlJ1xuXHQsICdjb250ZXh0bWVudSc6ICdjb250ZXh0TWVudSdcblx0LCAnY29udHJvbHMnOiAnY29udHJvbHMnXG5cdCwgJ2Nvb3Jkcyc6ICdjb29yZHMnXG5cdCwgJ2Nyb3Nzb3JpZ2luJzogJ2Nyb3NzT3JpZ2luJ1xuXHQsICdkYXRhJzogJ2RhdGEnXG5cdCwgJ2RhdGV0aW1lJzogJ2RhdGVUaW1lJ1xuXHQsICdkZWZhdWx0JzogJ2RlZmF1bHQnXG5cdCwgJ2RlZmVyJzogJ2RlZmVyJ1xuXHQsICdkaXInOiAnZGlyJ1xuXHQsICdkaXNhYmxlZCc6ICdkaXNhYmxlZCdcblx0LCAnZG93bmxvYWQnOiAnZG93bmxvYWQnXG5cdCwgJ2RyYWdnYWJsZSc6ICdkcmFnZ2FibGUnXG5cdCwgJ2Ryb3B6b25lJzogJ2Ryb3B6b25lJ1xuXHQsICdlbmN0eXBlJzogJ2VuY1R5cGUnXG5cdCwgJ2Zvcic6ICdodG1sRm9yJ1xuXHQsICdmb3JtJzogJ2Zvcm0nXG5cdCwgJ2Zvcm1hY3Rpb24nOiAnZm9ybUFjdGlvbidcblx0LCAnZm9ybWVuY3R5cGUnOiAnZm9ybUVuY1R5cGUnXG5cdCwgJ2Zvcm1tZXRob2QnOiAnZm9ybU1ldGhvZCdcblx0LCAnZm9ybW5vdmFsaWRhdGUnOiAnZm9ybU5vVmFsaWRhdGUnXG5cdCwgJ2Zvcm10YXJnZXQnOiAnZm9ybVRhcmdldCdcblx0LCAnZnJhbWVCb3JkZXInOiAnZnJhbWVCb3JkZXInXG5cdCwgJ2hlYWRlcnMnOiAnaGVhZGVycydcblx0LCAnaGVpZ2h0JzogJ2hlaWdodCdcblx0LCAnaGlkZGVuJzogJ2hpZGRlbidcblx0LCAnaGlnaCc6ICdoaWdoJ1xuXHQsICdocmVmJzogJ2hyZWYnXG5cdCwgJ2hyZWZsYW5nJzogJ2hyZWZMYW5nJ1xuXHQsICdodHRwLWVxdWl2JzogJ2h0dHBFcXVpdidcblx0LCAnaWNvbic6ICdpY29uJ1xuXHQsICdpZCc6ICdpZCdcblx0LCAnaW5wdXRtb2RlJzogJ2lucHV0TW9kZSdcblx0LCAnaXNtYXAnOiAnaXNNYXAnXG5cdCwgJ2l0ZW1pZCc6ICdpdGVtSWQnXG5cdCwgJ2l0ZW1wcm9wJzogJ2l0ZW1Qcm9wJ1xuXHQsICdpdGVtcmVmJzogJ2l0ZW1SZWYnXG5cdCwgJ2l0ZW1zY29wZSc6ICdpdGVtU2NvcGUnXG5cdCwgJ2l0ZW10eXBlJzogJ2l0ZW1UeXBlJ1xuXHQsICdraW5kJzogJ2tpbmQnXG5cdCwgJ2xhYmVsJzogJ2xhYmVsJ1xuXHQsICdsYW5nJzogJ2xhbmcnXG5cdCwgJ2xpc3QnOiAnbGlzdCdcblx0LCAnbG9vcCc6ICdsb29wJ1xuXHQsICdtYW5pZmVzdCc6ICdtYW5pZmVzdCdcblx0LCAnbWF4JzogJ21heCdcblx0LCAnbWF4bGVuZ3RoJzogJ21heExlbmd0aCdcblx0LCAnbWVkaWEnOiAnbWVkaWEnXG5cdCwgJ21lZGlhZ3JvdXAnOiAnbWVkaWFHcm91cCdcblx0LCAnbWV0aG9kJzogJ21ldGhvZCdcblx0LCAnbWluJzogJ21pbidcblx0LCAnbWlubGVuZ3RoJzogJ21pbkxlbmd0aCdcblx0LCAnbXVsdGlwbGUnOiAnbXVsdGlwbGUnXG5cdCwgJ211dGVkJzogJ211dGVkJ1xuXHQsICduYW1lJzogJ25hbWUnXG5cdCwgJ25vdmFsaWRhdGUnOiAnbm9WYWxpZGF0ZSdcblx0LCAnb3Blbic6ICdvcGVuJ1xuXHQsICdvcHRpbXVtJzogJ29wdGltdW0nXG5cdCwgJ3BhdHRlcm4nOiAncGF0dGVybidcblx0LCAncGluZyc6ICdwaW5nJ1xuXHQsICdwbGFjZWhvbGRlcic6ICdwbGFjZWhvbGRlcidcblx0LCAncG9zdGVyJzogJ3Bvc3Rlcidcblx0LCAncHJlbG9hZCc6ICdwcmVsb2FkJ1xuXHQsICdyYWRpb2dyb3VwJzogJ3JhZGlvR3JvdXAnXG5cdCwgJ3JlYWRvbmx5JzogJ3JlYWRPbmx5J1xuXHQsICdyZWwnOiAncmVsJ1xuXHQsICdyZXF1aXJlZCc6ICdyZXF1aXJlZCdcblx0LCAncm9sZSc6ICdyb2xlJ1xuXHQsICdyb3dzJzogJ3Jvd3MnXG5cdCwgJ3Jvd3NwYW4nOiAncm93U3Bhbidcblx0LCAnc2FuZGJveCc6ICdzYW5kYm94J1xuXHQsICdzY29wZSc6ICdzY29wZSdcblx0LCAnc2NvcGVkJzogJ3Njb3BlZCdcblx0LCAnc2Nyb2xsaW5nJzogJ3Njcm9sbGluZydcblx0LCAnc2VhbWxlc3MnOiAnc2VhbWxlc3MnXG5cdCwgJ3NlbGVjdGVkJzogJ3NlbGVjdGVkJ1xuXHQsICdzaGFwZSc6ICdzaGFwZSdcblx0LCAnc2l6ZSc6ICdzaXplJ1xuXHQsICdzaXplcyc6ICdzaXplcydcblx0LCAnc29ydGFibGUnOiAnc29ydGFibGUnXG5cdCwgJ3NwYW4nOiAnc3Bhbidcblx0LCAnc3BlbGxjaGVjayc6ICdzcGVsbENoZWNrJ1xuXHQsICdzcmMnOiAnc3JjJ1xuXHQsICdzcmNkb2MnOiAnc3JjRG9jJ1xuXHQsICdzcmNzZXQnOiAnc3JjU2V0J1xuXHQsICdzdGFydCc6ICdzdGFydCdcblx0LCAnc3RlcCc6ICdzdGVwJ1xuXHQsICdzdHlsZSc6ICdzdHlsZSdcblx0LCAndGFiaW5kZXgnOiAndGFiSW5kZXgnXG5cdCwgJ3RhcmdldCc6ICd0YXJnZXQnXG5cdCwgJ3RpdGxlJzogJ3RpdGxlJ1xuXHQsICd0cmFuc2xhdGUnOiAndHJhbnNsYXRlJ1xuXHQsICd0eXBlJzogJ3R5cGUnXG5cdCwgJ3R5cGVtdXN0bWF0Y2gnOiAndHlwZU11c3RNYXRjaCdcblx0LCAndXNlbWFwJzogJ3VzZU1hcCdcblx0LCAndmFsdWUnOiAndmFsdWUnXG5cdCwgJ3dpZHRoJzogJ3dpZHRoJ1xuXHQsICd3bW9kZSc6ICd3bW9kZSdcblx0LCAnd3JhcCc6ICd3cmFwJ1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBwcm9wZXJ0aWVzO1xuIiwidmFyIGNyZWF0ZUVsZW1lbnQgPSByZXF1aXJlKFwiLi92ZG9tL2NyZWF0ZS1lbGVtZW50LmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gY3JlYXRlRWxlbWVudFxuIiwidmFyIGRpZmYgPSByZXF1aXJlKFwiLi92dHJlZS9kaWZmLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gZGlmZlxuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNPYmplY3QoeCkge1xuXHRyZXR1cm4gdHlwZW9mIHggPT09IFwib2JqZWN0XCIgJiYgeCAhPT0gbnVsbDtcbn07XG4iLCJ2YXIgcGF0Y2ggPSByZXF1aXJlKFwiLi92ZG9tL3BhdGNoLmpzXCIpXG5cbm1vZHVsZS5leHBvcnRzID0gcGF0Y2hcbiIsInZhciBpc09iamVjdCA9IHJlcXVpcmUoXCJpcy1vYmplY3RcIilcbnZhciBpc0hvb2sgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdmhvb2suanNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBhcHBseVByb3BlcnRpZXNcblxuZnVuY3Rpb24gYXBwbHlQcm9wZXJ0aWVzKG5vZGUsIHByb3BzLCBwcmV2aW91cykge1xuICAgIGZvciAodmFyIHByb3BOYW1lIGluIHByb3BzKSB7XG4gICAgICAgIHZhciBwcm9wVmFsdWUgPSBwcm9wc1twcm9wTmFtZV1cblxuICAgICAgICBpZiAocHJvcFZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKTtcbiAgICAgICAgfSBlbHNlIGlmIChpc0hvb2socHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgcmVtb3ZlUHJvcGVydHkobm9kZSwgcHJvcE5hbWUsIHByb3BWYWx1ZSwgcHJldmlvdXMpXG4gICAgICAgICAgICBpZiAocHJvcFZhbHVlLmhvb2spIHtcbiAgICAgICAgICAgICAgICBwcm9wVmFsdWUuaG9vayhub2RlLFxuICAgICAgICAgICAgICAgICAgICBwcm9wTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWQpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoaXNPYmplY3QocHJvcFZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVByb3BlcnR5KG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUsIHByZXZpb3VzKSB7XG4gICAgaWYgKHByZXZpb3VzKSB7XG4gICAgICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXNbcHJvcE5hbWVdXG5cbiAgICAgICAgaWYgKCFpc0hvb2socHJldmlvdXNWYWx1ZSkpIHtcbiAgICAgICAgICAgIGlmIChwcm9wTmFtZSA9PT0gXCJhdHRyaWJ1dGVzXCIpIHtcbiAgICAgICAgICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcmV2aW91c1ZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAocHJvcE5hbWUgPT09IFwic3R5bGVcIikge1xuICAgICAgICAgICAgICAgIGZvciAodmFyIGkgaW4gcHJldmlvdXNWYWx1ZSkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnN0eWxlW2ldID0gXCJcIlxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHByZXZpb3VzVmFsdWUgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBub2RlW3Byb3BOYW1lXSA9IFwiXCJcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgbm9kZVtwcm9wTmFtZV0gPSBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAocHJldmlvdXNWYWx1ZS51bmhvb2spIHtcbiAgICAgICAgICAgIHByZXZpb3VzVmFsdWUudW5ob29rKG5vZGUsIHByb3BOYW1lLCBwcm9wVmFsdWUpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIHBhdGNoT2JqZWN0KG5vZGUsIHByb3BzLCBwcmV2aW91cywgcHJvcE5hbWUsIHByb3BWYWx1ZSkge1xuICAgIHZhciBwcmV2aW91c1ZhbHVlID0gcHJldmlvdXMgPyBwcmV2aW91c1twcm9wTmFtZV0gOiB1bmRlZmluZWRcblxuICAgIC8vIFNldCBhdHRyaWJ1dGVzXG4gICAgaWYgKHByb3BOYW1lID09PSBcImF0dHJpYnV0ZXNcIikge1xuICAgICAgICBmb3IgKHZhciBhdHRyTmFtZSBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgICAgIHZhciBhdHRyVmFsdWUgPSBwcm9wVmFsdWVbYXR0ck5hbWVdXG5cbiAgICAgICAgICAgIGlmIChhdHRyVmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgICAgIG5vZGUucmVtb3ZlQXR0cmlidXRlKGF0dHJOYW1lKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0clZhbHVlKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgaWYocHJldmlvdXNWYWx1ZSAmJiBpc09iamVjdChwcmV2aW91c1ZhbHVlKSAmJlxuICAgICAgICBnZXRQcm90b3R5cGUocHJldmlvdXNWYWx1ZSkgIT09IGdldFByb3RvdHlwZShwcm9wVmFsdWUpKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0gcHJvcFZhbHVlXG4gICAgICAgIHJldHVyblxuICAgIH1cblxuICAgIGlmICghaXNPYmplY3Qobm9kZVtwcm9wTmFtZV0pKSB7XG4gICAgICAgIG5vZGVbcHJvcE5hbWVdID0ge31cbiAgICB9XG5cbiAgICB2YXIgcmVwbGFjZXIgPSBwcm9wTmFtZSA9PT0gXCJzdHlsZVwiID8gXCJcIiA6IHVuZGVmaW5lZFxuXG4gICAgZm9yICh2YXIgayBpbiBwcm9wVmFsdWUpIHtcbiAgICAgICAgdmFyIHZhbHVlID0gcHJvcFZhbHVlW2tdXG4gICAgICAgIG5vZGVbcHJvcE5hbWVdW2tdID0gKHZhbHVlID09PSB1bmRlZmluZWQpID8gcmVwbGFjZXIgOiB2YWx1ZVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZ2V0UHJvdG90eXBlKHZhbHVlKSB7XG4gICAgaWYgKE9iamVjdC5nZXRQcm90b3R5cGVPZikge1xuICAgICAgICByZXR1cm4gT2JqZWN0LmdldFByb3RvdHlwZU9mKHZhbHVlKVxuICAgIH0gZWxzZSBpZiAodmFsdWUuX19wcm90b19fKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5fX3Byb3RvX19cbiAgICB9IGVsc2UgaWYgKHZhbHVlLmNvbnN0cnVjdG9yKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZS5jb25zdHJ1Y3Rvci5wcm90b3R5cGVcbiAgICB9XG59XG4iLCJ2YXIgZG9jdW1lbnQgPSByZXF1aXJlKFwiZ2xvYmFsL2RvY3VtZW50XCIpXG5cbnZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlLmpzXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dC5qc1wiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxudmFyIGhhbmRsZVRodW5rID0gcmVxdWlyZShcIi4uL3Zub2RlL2hhbmRsZS10aHVuay5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZUVsZW1lbnRcblxuZnVuY3Rpb24gY3JlYXRlRWxlbWVudCh2bm9kZSwgb3B0cykge1xuICAgIHZhciBkb2MgPSBvcHRzID8gb3B0cy5kb2N1bWVudCB8fCBkb2N1bWVudCA6IGRvY3VtZW50XG4gICAgdmFyIHdhcm4gPSBvcHRzID8gb3B0cy53YXJuIDogbnVsbFxuXG4gICAgdm5vZGUgPSBoYW5kbGVUaHVuayh2bm9kZSkuYVxuXG4gICAgaWYgKGlzV2lkZ2V0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gdm5vZGUuaW5pdCgpXG4gICAgfSBlbHNlIGlmIChpc1ZUZXh0KHZub2RlKSkge1xuICAgICAgICByZXR1cm4gZG9jLmNyZWF0ZVRleHROb2RlKHZub2RlLnRleHQpXG4gICAgfSBlbHNlIGlmICghaXNWTm9kZSh2bm9kZSkpIHtcbiAgICAgICAgaWYgKHdhcm4pIHtcbiAgICAgICAgICAgIHdhcm4oXCJJdGVtIGlzIG5vdCBhIHZhbGlkIHZpcnR1YWwgZG9tIG5vZGVcIiwgdm5vZGUpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG51bGxcbiAgICB9XG5cbiAgICB2YXIgbm9kZSA9ICh2bm9kZS5uYW1lc3BhY2UgPT09IG51bGwpID9cbiAgICAgICAgZG9jLmNyZWF0ZUVsZW1lbnQodm5vZGUudGFnTmFtZSkgOlxuICAgICAgICBkb2MuY3JlYXRlRWxlbWVudE5TKHZub2RlLm5hbWVzcGFjZSwgdm5vZGUudGFnTmFtZSlcblxuICAgIHZhciBwcm9wcyA9IHZub2RlLnByb3BlcnRpZXNcbiAgICBhcHBseVByb3BlcnRpZXMobm9kZSwgcHJvcHMpXG5cbiAgICB2YXIgY2hpbGRyZW4gPSB2bm9kZS5jaGlsZHJlblxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjaGlsZHJlbi5sZW5ndGg7IGkrKykge1xuICAgICAgICB2YXIgY2hpbGROb2RlID0gY3JlYXRlRWxlbWVudChjaGlsZHJlbltpXSwgb3B0cylcbiAgICAgICAgaWYgKGNoaWxkTm9kZSkge1xuICAgICAgICAgICAgbm9kZS5hcHBlbmRDaGlsZChjaGlsZE5vZGUpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gbm9kZVxufVxuIiwiLy8gTWFwcyBhIHZpcnR1YWwgRE9NIHRyZWUgb250byBhIHJlYWwgRE9NIHRyZWUgaW4gYW4gZWZmaWNpZW50IG1hbm5lci5cbi8vIFdlIGRvbid0IHdhbnQgdG8gcmVhZCBhbGwgb2YgdGhlIERPTSBub2RlcyBpbiB0aGUgdHJlZSBzbyB3ZSB1c2Vcbi8vIHRoZSBpbi1vcmRlciB0cmVlIGluZGV4aW5nIHRvIGVsaW1pbmF0ZSByZWN1cnNpb24gZG93biBjZXJ0YWluIGJyYW5jaGVzLlxuLy8gV2Ugb25seSByZWN1cnNlIGludG8gYSBET00gbm9kZSBpZiB3ZSBrbm93IHRoYXQgaXQgY29udGFpbnMgYSBjaGlsZCBvZlxuLy8gaW50ZXJlc3QuXG5cbnZhciBub0NoaWxkID0ge31cblxubW9kdWxlLmV4cG9ydHMgPSBkb21JbmRleFxuXG5mdW5jdGlvbiBkb21JbmRleChyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMpIHtcbiAgICBpZiAoIWluZGljZXMgfHwgaW5kaWNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIHt9XG4gICAgfSBlbHNlIHtcbiAgICAgICAgaW5kaWNlcy5zb3J0KGFzY2VuZGluZylcbiAgICAgICAgcmV0dXJuIHJlY3Vyc2Uocm9vdE5vZGUsIHRyZWUsIGluZGljZXMsIG5vZGVzLCAwKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVjdXJzZShyb290Tm9kZSwgdHJlZSwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleCkge1xuICAgIG5vZGVzID0gbm9kZXMgfHwge31cblxuXG4gICAgaWYgKHJvb3ROb2RlKSB7XG4gICAgICAgIGlmIChpbmRleEluUmFuZ2UoaW5kaWNlcywgcm9vdEluZGV4LCByb290SW5kZXgpKSB7XG4gICAgICAgICAgICBub2Rlc1tyb290SW5kZXhdID0gcm9vdE5vZGVcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciB2Q2hpbGRyZW4gPSB0cmVlLmNoaWxkcmVuXG5cbiAgICAgICAgaWYgKHZDaGlsZHJlbikge1xuXG4gICAgICAgICAgICB2YXIgY2hpbGROb2RlcyA9IHJvb3ROb2RlLmNoaWxkTm9kZXNcblxuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCB0cmVlLmNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICAgICAgcm9vdEluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHZhciB2Q2hpbGQgPSB2Q2hpbGRyZW5baV0gfHwgbm9DaGlsZFxuICAgICAgICAgICAgICAgIHZhciBuZXh0SW5kZXggPSByb290SW5kZXggKyAodkNoaWxkLmNvdW50IHx8IDApXG5cbiAgICAgICAgICAgICAgICAvLyBza2lwIHJlY3Vyc2lvbiBkb3duIHRoZSB0cmVlIGlmIHRoZXJlIGFyZSBubyBub2RlcyBkb3duIGhlcmVcbiAgICAgICAgICAgICAgICBpZiAoaW5kZXhJblJhbmdlKGluZGljZXMsIHJvb3RJbmRleCwgbmV4dEluZGV4KSkge1xuICAgICAgICAgICAgICAgICAgICByZWN1cnNlKGNoaWxkTm9kZXNbaV0sIHZDaGlsZCwgaW5kaWNlcywgbm9kZXMsIHJvb3RJbmRleClcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByb290SW5kZXggPSBuZXh0SW5kZXhcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBub2Rlc1xufVxuXG4vLyBCaW5hcnkgc2VhcmNoIGZvciBhbiBpbmRleCBpbiB0aGUgaW50ZXJ2YWwgW2xlZnQsIHJpZ2h0XVxuZnVuY3Rpb24gaW5kZXhJblJhbmdlKGluZGljZXMsIGxlZnQsIHJpZ2h0KSB7XG4gICAgaWYgKGluZGljZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cblxuICAgIHZhciBtaW5JbmRleCA9IDBcbiAgICB2YXIgbWF4SW5kZXggPSBpbmRpY2VzLmxlbmd0aCAtIDFcbiAgICB2YXIgY3VycmVudEluZGV4XG4gICAgdmFyIGN1cnJlbnRJdGVtXG5cbiAgICB3aGlsZSAobWluSW5kZXggPD0gbWF4SW5kZXgpIHtcbiAgICAgICAgY3VycmVudEluZGV4ID0gKChtYXhJbmRleCArIG1pbkluZGV4KSAvIDIpID4+IDBcbiAgICAgICAgY3VycmVudEl0ZW0gPSBpbmRpY2VzW2N1cnJlbnRJbmRleF1cblxuICAgICAgICBpZiAobWluSW5kZXggPT09IG1heEluZGV4KSB7XG4gICAgICAgICAgICByZXR1cm4gY3VycmVudEl0ZW0gPj0gbGVmdCAmJiBjdXJyZW50SXRlbSA8PSByaWdodFxuICAgICAgICB9IGVsc2UgaWYgKGN1cnJlbnRJdGVtIDwgbGVmdCkge1xuICAgICAgICAgICAgbWluSW5kZXggPSBjdXJyZW50SW5kZXggKyAxXG4gICAgICAgIH0gZWxzZSAgaWYgKGN1cnJlbnRJdGVtID4gcmlnaHQpIHtcbiAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRydWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gYXNjZW5kaW5nKGEsIGIpIHtcbiAgICByZXR1cm4gYSA+IGIgPyAxIDogLTFcbn1cbiIsInZhciBhcHBseVByb3BlcnRpZXMgPSByZXF1aXJlKFwiLi9hcHBseS1wcm9wZXJ0aWVzXCIpXG5cbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy13aWRnZXQuanNcIilcbnZhciBWUGF0Y2ggPSByZXF1aXJlKFwiLi4vdm5vZGUvdnBhdGNoLmpzXCIpXG5cbnZhciB1cGRhdGVXaWRnZXQgPSByZXF1aXJlKFwiLi91cGRhdGUtd2lkZ2V0XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gYXBwbHlQYXRjaFxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHZwYXRjaCwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciB0eXBlID0gdnBhdGNoLnR5cGVcbiAgICB2YXIgdk5vZGUgPSB2cGF0Y2gudk5vZGVcbiAgICB2YXIgcGF0Y2ggPSB2cGF0Y2gucGF0Y2hcblxuICAgIHN3aXRjaCAodHlwZSkge1xuICAgICAgICBjYXNlIFZQYXRjaC5SRU1PVkU6XG4gICAgICAgICAgICByZXR1cm4gcmVtb3ZlTm9kZShkb21Ob2RlLCB2Tm9kZSlcbiAgICAgICAgY2FzZSBWUGF0Y2guSU5TRVJUOlxuICAgICAgICAgICAgcmV0dXJuIGluc2VydE5vZGUoZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLlZURVhUOlxuICAgICAgICAgICAgcmV0dXJuIHN0cmluZ1BhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guV0lER0VUOlxuICAgICAgICAgICAgcmV0dXJuIHdpZGdldFBhdGNoKGRvbU5vZGUsIHZOb2RlLCBwYXRjaCwgcmVuZGVyT3B0aW9ucylcbiAgICAgICAgY2FzZSBWUGF0Y2guVk5PREU6XG4gICAgICAgICAgICByZXR1cm4gdk5vZGVQYXRjaChkb21Ob2RlLCB2Tm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpXG4gICAgICAgIGNhc2UgVlBhdGNoLk9SREVSOlxuICAgICAgICAgICAgcmVvcmRlckNoaWxkcmVuKGRvbU5vZGUsIHBhdGNoKVxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICAgICAgY2FzZSBWUGF0Y2guUFJPUFM6XG4gICAgICAgICAgICBhcHBseVByb3BlcnRpZXMoZG9tTm9kZSwgcGF0Y2gsIHZOb2RlLnByb3BlcnRpZXMpXG4gICAgICAgICAgICByZXR1cm4gZG9tTm9kZVxuICAgICAgICBjYXNlIFZQYXRjaC5USFVOSzpcbiAgICAgICAgICAgIHJldHVybiByZXBsYWNlUm9vdChkb21Ob2RlLFxuICAgICAgICAgICAgICAgIHJlbmRlck9wdGlvbnMucGF0Y2goZG9tTm9kZSwgcGF0Y2gsIHJlbmRlck9wdGlvbnMpKVxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIGRvbU5vZGVcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZU5vZGUoZG9tTm9kZSwgdk5vZGUpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuXG4gICAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICAgICAgcGFyZW50Tm9kZS5yZW1vdmVDaGlsZChkb21Ob2RlKVxuICAgIH1cblxuICAgIGRlc3Ryb3lXaWRnZXQoZG9tTm9kZSwgdk5vZGUpO1xuXG4gICAgcmV0dXJuIG51bGxcbn1cblxuZnVuY3Rpb24gaW5zZXJ0Tm9kZShwYXJlbnROb2RlLCB2Tm9kZSwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSkge1xuICAgICAgICBwYXJlbnROb2RlLmFwcGVuZENoaWxkKG5ld05vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcmVudE5vZGVcbn1cblxuZnVuY3Rpb24gc3RyaW5nUGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB2VGV4dCwgcmVuZGVyT3B0aW9ucykge1xuICAgIHZhciBuZXdOb2RlXG5cbiAgICBpZiAoZG9tTm9kZS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBkb21Ob2RlLnJlcGxhY2VEYXRhKDAsIGRvbU5vZGUubGVuZ3RoLCB2VGV4dC50ZXh0KVxuICAgICAgICBuZXdOb2RlID0gZG9tTm9kZVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG4gICAgICAgIG5ld05vZGUgPSByZW5kZXJPcHRpb25zLnJlbmRlcih2VGV4dCwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgICAgICBwYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdOb2RlLCBkb21Ob2RlKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gd2lkZ2V0UGF0Y2goZG9tTm9kZSwgbGVmdFZOb2RlLCB3aWRnZXQsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgdXBkYXRpbmcgPSB1cGRhdGVXaWRnZXQobGVmdFZOb2RlLCB3aWRnZXQpXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmICh1cGRhdGluZykge1xuICAgICAgICBuZXdOb2RlID0gd2lkZ2V0LnVwZGF0ZShsZWZ0Vk5vZGUsIGRvbU5vZGUpIHx8IGRvbU5vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIod2lkZ2V0LCByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHZhciBwYXJlbnROb2RlID0gZG9tTm9kZS5wYXJlbnROb2RlXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgaWYgKCF1cGRhdGluZykge1xuICAgICAgICBkZXN0cm95V2lkZ2V0KGRvbU5vZGUsIGxlZnRWTm9kZSlcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3Tm9kZVxufVxuXG5mdW5jdGlvbiB2Tm9kZVBhdGNoKGRvbU5vZGUsIGxlZnRWTm9kZSwgdk5vZGUsIHJlbmRlck9wdGlvbnMpIHtcbiAgICB2YXIgcGFyZW50Tm9kZSA9IGRvbU5vZGUucGFyZW50Tm9kZVxuICAgIHZhciBuZXdOb2RlID0gcmVuZGVyT3B0aW9ucy5yZW5kZXIodk5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICBpZiAocGFyZW50Tm9kZSAmJiBuZXdOb2RlICE9PSBkb21Ob2RlKSB7XG4gICAgICAgIHBhcmVudE5vZGUucmVwbGFjZUNoaWxkKG5ld05vZGUsIGRvbU5vZGUpXG4gICAgfVxuXG4gICAgcmV0dXJuIG5ld05vZGVcbn1cblxuZnVuY3Rpb24gZGVzdHJveVdpZGdldChkb21Ob2RlLCB3KSB7XG4gICAgaWYgKHR5cGVvZiB3LmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIiAmJiBpc1dpZGdldCh3KSkge1xuICAgICAgICB3LmRlc3Ryb3koZG9tTm9kZSlcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlb3JkZXJDaGlsZHJlbihkb21Ob2RlLCBtb3Zlcykge1xuICAgIHZhciBjaGlsZE5vZGVzID0gZG9tTm9kZS5jaGlsZE5vZGVzXG4gICAgdmFyIGtleU1hcCA9IHt9XG4gICAgdmFyIG5vZGVcbiAgICB2YXIgcmVtb3ZlXG4gICAgdmFyIGluc2VydFxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBtb3Zlcy5yZW1vdmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHJlbW92ZSA9IG1vdmVzLnJlbW92ZXNbaV1cbiAgICAgICAgbm9kZSA9IGNoaWxkTm9kZXNbcmVtb3ZlLmZyb21dXG4gICAgICAgIGlmIChyZW1vdmUua2V5KSB7XG4gICAgICAgICAgICBrZXlNYXBbcmVtb3ZlLmtleV0gPSBub2RlXG4gICAgICAgIH1cbiAgICAgICAgZG9tTm9kZS5yZW1vdmVDaGlsZChub2RlKVxuICAgIH1cblxuICAgIHZhciBsZW5ndGggPSBjaGlsZE5vZGVzLmxlbmd0aFxuICAgIGZvciAodmFyIGogPSAwOyBqIDwgbW92ZXMuaW5zZXJ0cy5sZW5ndGg7IGorKykge1xuICAgICAgICBpbnNlcnQgPSBtb3Zlcy5pbnNlcnRzW2pdXG4gICAgICAgIG5vZGUgPSBrZXlNYXBbaW5zZXJ0LmtleV1cbiAgICAgICAgLy8gdGhpcyBpcyB0aGUgd2VpcmRlc3QgYnVnIGkndmUgZXZlciBzZWVuIGluIHdlYmtpdFxuICAgICAgICBkb21Ob2RlLmluc2VydEJlZm9yZShub2RlLCBpbnNlcnQudG8gPj0gbGVuZ3RoKysgPyBudWxsIDogY2hpbGROb2Rlc1tpbnNlcnQudG9dKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gcmVwbGFjZVJvb3Qob2xkUm9vdCwgbmV3Um9vdCkge1xuICAgIGlmIChvbGRSb290ICYmIG5ld1Jvb3QgJiYgb2xkUm9vdCAhPT0gbmV3Um9vdCAmJiBvbGRSb290LnBhcmVudE5vZGUpIHtcbiAgICAgICAgb2xkUm9vdC5wYXJlbnROb2RlLnJlcGxhY2VDaGlsZChuZXdSb290LCBvbGRSb290KVxuICAgIH1cblxuICAgIHJldHVybiBuZXdSb290O1xufVxuIiwidmFyIGRvY3VtZW50ID0gcmVxdWlyZShcImdsb2JhbC9kb2N1bWVudFwiKVxudmFyIGlzQXJyYXkgPSByZXF1aXJlKFwieC1pcy1hcnJheVwiKVxuXG52YXIgcmVuZGVyID0gcmVxdWlyZShcIi4vY3JlYXRlLWVsZW1lbnRcIilcbnZhciBkb21JbmRleCA9IHJlcXVpcmUoXCIuL2RvbS1pbmRleFwiKVxudmFyIHBhdGNoT3AgPSByZXF1aXJlKFwiLi9wYXRjaC1vcFwiKVxubW9kdWxlLmV4cG9ydHMgPSBwYXRjaFxuXG5mdW5jdGlvbiBwYXRjaChyb290Tm9kZSwgcGF0Y2hlcywgcmVuZGVyT3B0aW9ucykge1xuICAgIHJlbmRlck9wdGlvbnMgPSByZW5kZXJPcHRpb25zIHx8IHt9XG4gICAgcmVuZGVyT3B0aW9ucy5wYXRjaCA9IHJlbmRlck9wdGlvbnMucGF0Y2ggJiYgcmVuZGVyT3B0aW9ucy5wYXRjaCAhPT0gcGF0Y2hcbiAgICAgICAgPyByZW5kZXJPcHRpb25zLnBhdGNoXG4gICAgICAgIDogcGF0Y2hSZWN1cnNpdmVcbiAgICByZW5kZXJPcHRpb25zLnJlbmRlciA9IHJlbmRlck9wdGlvbnMucmVuZGVyIHx8IHJlbmRlclxuXG4gICAgcmV0dXJuIHJlbmRlck9wdGlvbnMucGF0Y2gocm9vdE5vZGUsIHBhdGNoZXMsIHJlbmRlck9wdGlvbnMpXG59XG5cbmZ1bmN0aW9uIHBhdGNoUmVjdXJzaXZlKHJvb3ROb2RlLCBwYXRjaGVzLCByZW5kZXJPcHRpb25zKSB7XG4gICAgdmFyIGluZGljZXMgPSBwYXRjaEluZGljZXMocGF0Y2hlcylcblxuICAgIGlmIChpbmRpY2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICByZXR1cm4gcm9vdE5vZGVcbiAgICB9XG5cbiAgICB2YXIgaW5kZXggPSBkb21JbmRleChyb290Tm9kZSwgcGF0Y2hlcy5hLCBpbmRpY2VzKVxuICAgIHZhciBvd25lckRvY3VtZW50ID0gcm9vdE5vZGUub3duZXJEb2N1bWVudFxuXG4gICAgaWYgKCFyZW5kZXJPcHRpb25zLmRvY3VtZW50ICYmIG93bmVyRG9jdW1lbnQgIT09IGRvY3VtZW50KSB7XG4gICAgICAgIHJlbmRlck9wdGlvbnMuZG9jdW1lbnQgPSBvd25lckRvY3VtZW50XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBpbmRpY2VzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBub2RlSW5kZXggPSBpbmRpY2VzW2ldXG4gICAgICAgIHJvb3ROb2RlID0gYXBwbHlQYXRjaChyb290Tm9kZSxcbiAgICAgICAgICAgIGluZGV4W25vZGVJbmRleF0sXG4gICAgICAgICAgICBwYXRjaGVzW25vZGVJbmRleF0sXG4gICAgICAgICAgICByZW5kZXJPcHRpb25zKVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBhcHBseVBhdGNoKHJvb3ROb2RlLCBkb21Ob2RlLCBwYXRjaExpc3QsIHJlbmRlck9wdGlvbnMpIHtcbiAgICBpZiAoIWRvbU5vZGUpIHtcbiAgICAgICAgcmV0dXJuIHJvb3ROb2RlXG4gICAgfVxuXG4gICAgdmFyIG5ld05vZGVcblxuICAgIGlmIChpc0FycmF5KHBhdGNoTGlzdCkpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwYXRjaExpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIG5ld05vZGUgPSBwYXRjaE9wKHBhdGNoTGlzdFtpXSwgZG9tTm9kZSwgcmVuZGVyT3B0aW9ucylcblxuICAgICAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgcm9vdE5vZGUgPSBuZXdOb2RlXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgICBuZXdOb2RlID0gcGF0Y2hPcChwYXRjaExpc3QsIGRvbU5vZGUsIHJlbmRlck9wdGlvbnMpXG5cbiAgICAgICAgaWYgKGRvbU5vZGUgPT09IHJvb3ROb2RlKSB7XG4gICAgICAgICAgICByb290Tm9kZSA9IG5ld05vZGVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiByb290Tm9kZVxufVxuXG5mdW5jdGlvbiBwYXRjaEluZGljZXMocGF0Y2hlcykge1xuICAgIHZhciBpbmRpY2VzID0gW11cblxuICAgIGZvciAodmFyIGtleSBpbiBwYXRjaGVzKSB7XG4gICAgICAgIGlmIChrZXkgIT09IFwiYVwiKSB7XG4gICAgICAgICAgICBpbmRpY2VzLnB1c2goTnVtYmVyKGtleSkpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gaW5kaWNlc1xufVxuIiwidmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldC5qc1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHVwZGF0ZVdpZGdldFxuXG5mdW5jdGlvbiB1cGRhdGVXaWRnZXQoYSwgYikge1xuICAgIGlmIChpc1dpZGdldChhKSAmJiBpc1dpZGdldChiKSkge1xuICAgICAgICBpZiAoXCJuYW1lXCIgaW4gYSAmJiBcIm5hbWVcIiBpbiBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYS5pZCA9PT0gYi5pZFxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGEuaW5pdCA9PT0gYi5pbml0XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gZmFsc2Vcbn1cbiIsInZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1ZUZXh0ID0gcmVxdWlyZShcIi4vaXMtdnRleHRcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhhbmRsZVRodW5rXG5cbmZ1bmN0aW9uIGhhbmRsZVRodW5rKGEsIGIpIHtcbiAgICB2YXIgcmVuZGVyZWRBID0gYVxuICAgIHZhciByZW5kZXJlZEIgPSBiXG5cbiAgICBpZiAoaXNUaHVuayhiKSkge1xuICAgICAgICByZW5kZXJlZEIgPSByZW5kZXJUaHVuayhiLCBhKVxuICAgIH1cblxuICAgIGlmIChpc1RodW5rKGEpKSB7XG4gICAgICAgIHJlbmRlcmVkQSA9IHJlbmRlclRodW5rKGEsIG51bGwpXG4gICAgfVxuXG4gICAgcmV0dXJuIHtcbiAgICAgICAgYTogcmVuZGVyZWRBLFxuICAgICAgICBiOiByZW5kZXJlZEJcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHJlbmRlclRodW5rKHRodW5rLCBwcmV2aW91cykge1xuICAgIHZhciByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGVcblxuICAgIGlmICghcmVuZGVyZWRUaHVuaykge1xuICAgICAgICByZW5kZXJlZFRodW5rID0gdGh1bmsudm5vZGUgPSB0aHVuay5yZW5kZXIocHJldmlvdXMpXG4gICAgfVxuXG4gICAgaWYgKCEoaXNWTm9kZShyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNWVGV4dChyZW5kZXJlZFRodW5rKSB8fFxuICAgICAgICAgICAgaXNXaWRnZXQocmVuZGVyZWRUaHVuaykpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcInRodW5rIGRpZCBub3QgcmV0dXJuIGEgdmFsaWQgbm9kZVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVuZGVyZWRUaHVua1xufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1RodW5rXHJcblxyXG5mdW5jdGlvbiBpc1RodW5rKHQpIHtcclxuICAgIHJldHVybiB0ICYmIHQudHlwZSA9PT0gXCJUaHVua1wiXHJcbn1cclxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc0hvb2tcblxuZnVuY3Rpb24gaXNIb29rKGhvb2spIHtcbiAgICByZXR1cm4gaG9vayAmJlxuICAgICAgKHR5cGVvZiBob29rLmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcImhvb2tcIikgfHxcbiAgICAgICB0eXBlb2YgaG9vay51bmhvb2sgPT09IFwiZnVuY3Rpb25cIiAmJiAhaG9vay5oYXNPd25Qcm9wZXJ0eShcInVuaG9va1wiKSlcbn1cbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGlzVmlydHVhbE5vZGVcblxuZnVuY3Rpb24gaXNWaXJ0dWFsTm9kZSh4KSB7XG4gICAgcmV0dXJuIHggJiYgeC50eXBlID09PSBcIlZpcnR1YWxOb2RlXCIgJiYgeC52ZXJzaW9uID09PSB2ZXJzaW9uXG59XG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcblxubW9kdWxlLmV4cG9ydHMgPSBpc1ZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIGlzVmlydHVhbFRleHQoeCkge1xuICAgIHJldHVybiB4ICYmIHgudHlwZSA9PT0gXCJWaXJ0dWFsVGV4dFwiICYmIHgudmVyc2lvbiA9PT0gdmVyc2lvblxufVxuIiwibW9kdWxlLmV4cG9ydHMgPSBpc1dpZGdldFxuXG5mdW5jdGlvbiBpc1dpZGdldCh3KSB7XG4gICAgcmV0dXJuIHcgJiYgdy50eXBlID09PSBcIldpZGdldFwiXG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IFwiMlwiXG4iLCJ2YXIgdmVyc2lvbiA9IHJlcXVpcmUoXCIuL3ZlcnNpb25cIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4vaXMtdm5vZGVcIilcbnZhciBpc1dpZGdldCA9IHJlcXVpcmUoXCIuL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi9pcy10aHVua1wiKVxudmFyIGlzVkhvb2sgPSByZXF1aXJlKFwiLi9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxOb2RlXG5cbnZhciBub1Byb3BlcnRpZXMgPSB7fVxudmFyIG5vQ2hpbGRyZW4gPSBbXVxuXG5mdW5jdGlvbiBWaXJ0dWFsTm9kZSh0YWdOYW1lLCBwcm9wZXJ0aWVzLCBjaGlsZHJlbiwga2V5LCBuYW1lc3BhY2UpIHtcbiAgICB0aGlzLnRhZ05hbWUgPSB0YWdOYW1lXG4gICAgdGhpcy5wcm9wZXJ0aWVzID0gcHJvcGVydGllcyB8fCBub1Byb3BlcnRpZXNcbiAgICB0aGlzLmNoaWxkcmVuID0gY2hpbGRyZW4gfHwgbm9DaGlsZHJlblxuICAgIHRoaXMua2V5ID0ga2V5ICE9IG51bGwgPyBTdHJpbmcoa2V5KSA6IHVuZGVmaW5lZFxuICAgIHRoaXMubmFtZXNwYWNlID0gKHR5cGVvZiBuYW1lc3BhY2UgPT09IFwic3RyaW5nXCIpID8gbmFtZXNwYWNlIDogbnVsbFxuXG4gICAgdmFyIGNvdW50ID0gKGNoaWxkcmVuICYmIGNoaWxkcmVuLmxlbmd0aCkgfHwgMFxuICAgIHZhciBkZXNjZW5kYW50cyA9IDBcbiAgICB2YXIgaGFzV2lkZ2V0cyA9IGZhbHNlXG4gICAgdmFyIGhhc1RodW5rcyA9IGZhbHNlXG4gICAgdmFyIGRlc2NlbmRhbnRIb29rcyA9IGZhbHNlXG4gICAgdmFyIGhvb2tzXG5cbiAgICBmb3IgKHZhciBwcm9wTmFtZSBpbiBwcm9wZXJ0aWVzKSB7XG4gICAgICAgIGlmIChwcm9wZXJ0aWVzLmhhc093blByb3BlcnR5KHByb3BOYW1lKSkge1xuICAgICAgICAgICAgdmFyIHByb3BlcnR5ID0gcHJvcGVydGllc1twcm9wTmFtZV1cbiAgICAgICAgICAgIGlmIChpc1ZIb29rKHByb3BlcnR5KSAmJiBwcm9wZXJ0eS51bmhvb2spIHtcbiAgICAgICAgICAgICAgICBpZiAoIWhvb2tzKSB7XG4gICAgICAgICAgICAgICAgICAgIGhvb2tzID0ge31cbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBob29rc1twcm9wTmFtZV0gPSBwcm9wZXJ0eVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb3VudDsgaSsrKSB7XG4gICAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldXG4gICAgICAgIGlmIChpc1ZOb2RlKGNoaWxkKSkge1xuICAgICAgICAgICAgZGVzY2VuZGFudHMgKz0gY2hpbGQuY291bnQgfHwgMFxuXG4gICAgICAgICAgICBpZiAoIWhhc1dpZGdldHMgJiYgY2hpbGQuaGFzV2lkZ2V0cykge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmICghaGFzVGh1bmtzICYmIGNoaWxkLmhhc1RodW5rcykge1xuICAgICAgICAgICAgICAgIGhhc1RodW5rcyA9IHRydWVcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFkZXNjZW5kYW50SG9va3MgJiYgKGNoaWxkLmhvb2tzIHx8IGNoaWxkLmRlc2NlbmRhbnRIb29rcykpIHtcbiAgICAgICAgICAgICAgICBkZXNjZW5kYW50SG9va3MgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1dpZGdldHMgJiYgaXNXaWRnZXQoY2hpbGQpKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIGNoaWxkLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgICAgIGhhc1dpZGdldHMgPSB0cnVlXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoIWhhc1RodW5rcyAmJiBpc1RodW5rKGNoaWxkKSkge1xuICAgICAgICAgICAgaGFzVGh1bmtzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMuY291bnQgPSBjb3VudCArIGRlc2NlbmRhbnRzXG4gICAgdGhpcy5oYXNXaWRnZXRzID0gaGFzV2lkZ2V0c1xuICAgIHRoaXMuaGFzVGh1bmtzID0gaGFzVGh1bmtzXG4gICAgdGhpcy5ob29rcyA9IGhvb2tzXG4gICAgdGhpcy5kZXNjZW5kYW50SG9va3MgPSBkZXNjZW5kYW50SG9va3Ncbn1cblxuVmlydHVhbE5vZGUucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsTm9kZS5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbE5vZGVcIlxuIiwidmFyIHZlcnNpb24gPSByZXF1aXJlKFwiLi92ZXJzaW9uXCIpXG5cblZpcnR1YWxQYXRjaC5OT05FID0gMFxuVmlydHVhbFBhdGNoLlZURVhUID0gMVxuVmlydHVhbFBhdGNoLlZOT0RFID0gMlxuVmlydHVhbFBhdGNoLldJREdFVCA9IDNcblZpcnR1YWxQYXRjaC5QUk9QUyA9IDRcblZpcnR1YWxQYXRjaC5PUkRFUiA9IDVcblZpcnR1YWxQYXRjaC5JTlNFUlQgPSA2XG5WaXJ0dWFsUGF0Y2guUkVNT1ZFID0gN1xuVmlydHVhbFBhdGNoLlRIVU5LID0gOFxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxQYXRjaFxuXG5mdW5jdGlvbiBWaXJ0dWFsUGF0Y2godHlwZSwgdk5vZGUsIHBhdGNoKSB7XG4gICAgdGhpcy50eXBlID0gTnVtYmVyKHR5cGUpXG4gICAgdGhpcy52Tm9kZSA9IHZOb2RlXG4gICAgdGhpcy5wYXRjaCA9IHBhdGNoXG59XG5cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudmVyc2lvbiA9IHZlcnNpb25cblZpcnR1YWxQYXRjaC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFBhdGNoXCJcbiIsInZhciB2ZXJzaW9uID0gcmVxdWlyZShcIi4vdmVyc2lvblwiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IFZpcnR1YWxUZXh0XG5cbmZ1bmN0aW9uIFZpcnR1YWxUZXh0KHRleHQpIHtcbiAgICB0aGlzLnRleHQgPSBTdHJpbmcodGV4dClcbn1cblxuVmlydHVhbFRleHQucHJvdG90eXBlLnZlcnNpb24gPSB2ZXJzaW9uXG5WaXJ0dWFsVGV4dC5wcm90b3R5cGUudHlwZSA9IFwiVmlydHVhbFRleHRcIlxuIiwidmFyIGlzT2JqZWN0ID0gcmVxdWlyZShcImlzLW9iamVjdFwiKVxudmFyIGlzSG9vayA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12aG9va1wiKVxuXG5tb2R1bGUuZXhwb3J0cyA9IGRpZmZQcm9wc1xuXG5mdW5jdGlvbiBkaWZmUHJvcHMoYSwgYikge1xuICAgIHZhciBkaWZmXG5cbiAgICBmb3IgKHZhciBhS2V5IGluIGEpIHtcbiAgICAgICAgaWYgKCEoYUtleSBpbiBiKSkge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSB1bmRlZmluZWRcbiAgICAgICAgfVxuXG4gICAgICAgIHZhciBhVmFsdWUgPSBhW2FLZXldXG4gICAgICAgIHZhciBiVmFsdWUgPSBiW2FLZXldXG5cbiAgICAgICAgaWYgKGFWYWx1ZSA9PT0gYlZhbHVlKSB7XG4gICAgICAgICAgICBjb250aW51ZVxuICAgICAgICB9IGVsc2UgaWYgKGlzT2JqZWN0KGFWYWx1ZSkgJiYgaXNPYmplY3QoYlZhbHVlKSkge1xuICAgICAgICAgICAgaWYgKGdldFByb3RvdHlwZShiVmFsdWUpICE9PSBnZXRQcm90b3R5cGUoYVZhbHVlKSkge1xuICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgZGlmZlthS2V5XSA9IGJWYWx1ZVxuICAgICAgICAgICAgfSBlbHNlIGlmIChpc0hvb2soYlZhbHVlKSkge1xuICAgICAgICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgICAgICBkaWZmW2FLZXldID0gYlZhbHVlXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHZhciBvYmplY3REaWZmID0gZGlmZlByb3BzKGFWYWx1ZSwgYlZhbHVlKVxuICAgICAgICAgICAgICAgIGlmIChvYmplY3REaWZmKSB7XG4gICAgICAgICAgICAgICAgICAgIGRpZmYgPSBkaWZmIHx8IHt9XG4gICAgICAgICAgICAgICAgICAgIGRpZmZbYUtleV0gPSBvYmplY3REaWZmXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZGlmZiA9IGRpZmYgfHwge31cbiAgICAgICAgICAgIGRpZmZbYUtleV0gPSBiVmFsdWVcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZvciAodmFyIGJLZXkgaW4gYikge1xuICAgICAgICBpZiAoIShiS2V5IGluIGEpKSB7XG4gICAgICAgICAgICBkaWZmID0gZGlmZiB8fCB7fVxuICAgICAgICAgICAgZGlmZltiS2V5XSA9IGJbYktleV1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBkaWZmXG59XG5cbmZ1bmN0aW9uIGdldFByb3RvdHlwZSh2YWx1ZSkge1xuICBpZiAoT2JqZWN0LmdldFByb3RvdHlwZU9mKSB7XG4gICAgcmV0dXJuIE9iamVjdC5nZXRQcm90b3R5cGVPZih2YWx1ZSlcbiAgfSBlbHNlIGlmICh2YWx1ZS5fX3Byb3RvX18pIHtcbiAgICByZXR1cm4gdmFsdWUuX19wcm90b19fXG4gIH0gZWxzZSBpZiAodmFsdWUuY29uc3RydWN0b3IpIHtcbiAgICByZXR1cm4gdmFsdWUuY29uc3RydWN0b3IucHJvdG90eXBlXG4gIH1cbn1cbiIsInZhciBpc0FycmF5ID0gcmVxdWlyZShcIngtaXMtYXJyYXlcIilcblxudmFyIFZQYXRjaCA9IHJlcXVpcmUoXCIuLi92bm9kZS92cGF0Y2hcIilcbnZhciBpc1ZOb2RlID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXZub2RlXCIpXG52YXIgaXNWVGV4dCA9IHJlcXVpcmUoXCIuLi92bm9kZS9pcy12dGV4dFwiKVxudmFyIGlzV2lkZ2V0ID0gcmVxdWlyZShcIi4uL3Zub2RlL2lzLXdpZGdldFwiKVxudmFyIGlzVGh1bmsgPSByZXF1aXJlKFwiLi4vdm5vZGUvaXMtdGh1bmtcIilcbnZhciBoYW5kbGVUaHVuayA9IHJlcXVpcmUoXCIuLi92bm9kZS9oYW5kbGUtdGh1bmtcIilcblxudmFyIGRpZmZQcm9wcyA9IHJlcXVpcmUoXCIuL2RpZmYtcHJvcHNcIilcblxubW9kdWxlLmV4cG9ydHMgPSBkaWZmXG5cbmZ1bmN0aW9uIGRpZmYoYSwgYikge1xuICAgIHZhciBwYXRjaCA9IHsgYTogYSB9XG4gICAgd2FsayhhLCBiLCBwYXRjaCwgMClcbiAgICByZXR1cm4gcGF0Y2hcbn1cblxuZnVuY3Rpb24gd2FsayhhLCBiLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoYSA9PT0gYikge1xuICAgICAgICByZXR1cm5cbiAgICB9XG5cbiAgICB2YXIgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICB2YXIgYXBwbHlDbGVhciA9IGZhbHNlXG5cbiAgICBpZiAoaXNUaHVuayhhKSB8fCBpc1RodW5rKGIpKSB7XG4gICAgICAgIHRodW5rcyhhLCBiLCBwYXRjaCwgaW5kZXgpXG4gICAgfSBlbHNlIGlmIChiID09IG51bGwpIHtcblxuICAgICAgICAvLyBJZiBhIGlzIGEgd2lkZ2V0IHdlIHdpbGwgYWRkIGEgcmVtb3ZlIHBhdGNoIGZvciBpdFxuICAgICAgICAvLyBPdGhlcndpc2UgYW55IGNoaWxkIHdpZGdldHMvaG9va3MgbXVzdCBiZSBkZXN0cm95ZWQuXG4gICAgICAgIC8vIFRoaXMgcHJldmVudHMgYWRkaW5nIHR3byByZW1vdmUgcGF0Y2hlcyBmb3IgYSB3aWRnZXQuXG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICAgICAgYXBwbHkgPSBwYXRjaFtpbmRleF1cbiAgICAgICAgfVxuXG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgYSwgYikpXG4gICAgfSBlbHNlIGlmIChpc1ZOb2RlKGIpKSB7XG4gICAgICAgIGlmIChpc1ZOb2RlKGEpKSB7XG4gICAgICAgICAgICBpZiAoYS50YWdOYW1lID09PSBiLnRhZ05hbWUgJiZcbiAgICAgICAgICAgICAgICBhLm5hbWVzcGFjZSA9PT0gYi5uYW1lc3BhY2UgJiZcbiAgICAgICAgICAgICAgICBhLmtleSA9PT0gYi5rZXkpIHtcbiAgICAgICAgICAgICAgICB2YXIgcHJvcHNQYXRjaCA9IGRpZmZQcm9wcyhhLnByb3BlcnRpZXMsIGIucHJvcGVydGllcylcbiAgICAgICAgICAgICAgICBpZiAocHJvcHNQYXRjaCkge1xuICAgICAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LFxuICAgICAgICAgICAgICAgICAgICAgICAgbmV3IFZQYXRjaChWUGF0Y2guUFJPUFMsIGEsIHByb3BzUGF0Y2gpKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBhcHBseSA9IGRpZmZDaGlsZHJlbihhLCBiLCBwYXRjaCwgYXBwbHksIGluZGV4KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WTk9ERSwgYSwgYikpXG4gICAgICAgICAgICAgICAgYXBwbHlDbGVhciA9IHRydWVcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goVlBhdGNoLlZOT0RFLCBhLCBiKSlcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVlRleHQoYikpIHtcbiAgICAgICAgaWYgKCFpc1ZUZXh0KGEpKSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgICAgICBhcHBseUNsZWFyID0gdHJ1ZVxuICAgICAgICB9IGVsc2UgaWYgKGEudGV4dCAhPT0gYi50ZXh0KSB7XG4gICAgICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5WVEVYVCwgYSwgYikpXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzV2lkZ2V0KGIpKSB7XG4gICAgICAgIGlmICghaXNXaWRnZXQoYSkpIHtcbiAgICAgICAgICAgIGFwcGx5Q2xlYXIgPSB0cnVlXG4gICAgICAgIH1cblxuICAgICAgICBhcHBseSA9IGFwcGVuZFBhdGNoKGFwcGx5LCBuZXcgVlBhdGNoKFZQYXRjaC5XSURHRVQsIGEsIGIpKVxuICAgIH1cblxuICAgIGlmIChhcHBseSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBseVxuICAgIH1cblxuICAgIGlmIChhcHBseUNsZWFyKSB7XG4gICAgICAgIGNsZWFyU3RhdGUoYSwgcGF0Y2gsIGluZGV4KVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZGlmZkNoaWxkcmVuKGEsIGIsIHBhdGNoLCBhcHBseSwgaW5kZXgpIHtcbiAgICB2YXIgYUNoaWxkcmVuID0gYS5jaGlsZHJlblxuICAgIHZhciBvcmRlcmVkU2V0ID0gcmVvcmRlcihhQ2hpbGRyZW4sIGIuY2hpbGRyZW4pXG4gICAgdmFyIGJDaGlsZHJlbiA9IG9yZGVyZWRTZXQuY2hpbGRyZW5cblxuICAgIHZhciBhTGVuID0gYUNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBiTGVuID0gYkNoaWxkcmVuLmxlbmd0aFxuICAgIHZhciBsZW4gPSBhTGVuID4gYkxlbiA/IGFMZW4gOiBiTGVuXG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIHZhciBsZWZ0Tm9kZSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgcmlnaHROb2RlID0gYkNoaWxkcmVuW2ldXG4gICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICBpZiAoIWxlZnROb2RlKSB7XG4gICAgICAgICAgICBpZiAocmlnaHROb2RlKSB7XG4gICAgICAgICAgICAgICAgLy8gRXhjZXNzIG5vZGVzIGluIGIgbmVlZCB0byBiZSBhZGRlZFxuICAgICAgICAgICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksXG4gICAgICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLklOU0VSVCwgbnVsbCwgcmlnaHROb2RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHdhbGsobGVmdE5vZGUsIHJpZ2h0Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzVk5vZGUobGVmdE5vZGUpICYmIGxlZnROb2RlLmNvdW50KSB7XG4gICAgICAgICAgICBpbmRleCArPSBsZWZ0Tm9kZS5jb3VudFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9yZGVyZWRTZXQubW92ZXMpIHtcbiAgICAgICAgLy8gUmVvcmRlciBub2RlcyBsYXN0XG4gICAgICAgIGFwcGx5ID0gYXBwZW5kUGF0Y2goYXBwbHksIG5ldyBWUGF0Y2goXG4gICAgICAgICAgICBWUGF0Y2guT1JERVIsXG4gICAgICAgICAgICBhLFxuICAgICAgICAgICAgb3JkZXJlZFNldC5tb3Zlc1xuICAgICAgICApKVxuICAgIH1cblxuICAgIHJldHVybiBhcHBseVxufVxuXG5mdW5jdGlvbiBjbGVhclN0YXRlKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICAvLyBUT0RPOiBNYWtlIHRoaXMgYSBzaW5nbGUgd2Fsaywgbm90IHR3b1xuICAgIHVuaG9vayh2Tm9kZSwgcGF0Y2gsIGluZGV4KVxuICAgIGRlc3Ryb3lXaWRnZXRzKHZOb2RlLCBwYXRjaCwgaW5kZXgpXG59XG5cbi8vIFBhdGNoIHJlY29yZHMgZm9yIGFsbCBkZXN0cm95ZWQgd2lkZ2V0cyBtdXN0IGJlIGFkZGVkIGJlY2F1c2Ugd2UgbmVlZFxuLy8gYSBET00gbm9kZSByZWZlcmVuY2UgZm9yIHRoZSBkZXN0cm95IGZ1bmN0aW9uXG5mdW5jdGlvbiBkZXN0cm95V2lkZ2V0cyh2Tm9kZSwgcGF0Y2gsIGluZGV4KSB7XG4gICAgaWYgKGlzV2lkZ2V0KHZOb2RlKSkge1xuICAgICAgICBpZiAodHlwZW9mIHZOb2RlLmRlc3Ryb3kgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgcGF0Y2hbaW5kZXhdID0gYXBwZW5kUGF0Y2goXG4gICAgICAgICAgICAgICAgcGF0Y2hbaW5kZXhdLFxuICAgICAgICAgICAgICAgIG5ldyBWUGF0Y2goVlBhdGNoLlJFTU9WRSwgdk5vZGUsIG51bGwpXG4gICAgICAgICAgICApXG4gICAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGlzVk5vZGUodk5vZGUpICYmICh2Tm9kZS5oYXNXaWRnZXRzIHx8IHZOb2RlLmhhc1RodW5rcykpIHtcbiAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgdmFyIGxlbiA9IGNoaWxkcmVuLmxlbmd0aFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgaW5kZXggKz0gMVxuXG4gICAgICAgICAgICBkZXN0cm95V2lkZ2V0cyhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICBpZiAoaXNWTm9kZShjaGlsZCkgJiYgY2hpbGQuY291bnQpIHtcbiAgICAgICAgICAgICAgICBpbmRleCArPSBjaGlsZC5jb3VudFxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbi8vIENyZWF0ZSBhIHN1Yi1wYXRjaCBmb3IgdGh1bmtzXG5mdW5jdGlvbiB0aHVua3MoYSwgYiwgcGF0Y2gsIGluZGV4KSB7XG4gICAgdmFyIG5vZGVzID0gaGFuZGxlVGh1bmsoYSwgYilcbiAgICB2YXIgdGh1bmtQYXRjaCA9IGRpZmYobm9kZXMuYSwgbm9kZXMuYilcbiAgICBpZiAoaGFzUGF0Y2hlcyh0aHVua1BhdGNoKSkge1xuICAgICAgICBwYXRjaFtpbmRleF0gPSBuZXcgVlBhdGNoKFZQYXRjaC5USFVOSywgbnVsbCwgdGh1bmtQYXRjaClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGhhc1BhdGNoZXMocGF0Y2gpIHtcbiAgICBmb3IgKHZhciBpbmRleCBpbiBwYXRjaCkge1xuICAgICAgICBpZiAoaW5kZXggIT09IFwiYVwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlXG59XG5cbi8vIEV4ZWN1dGUgaG9va3Mgd2hlbiB0d28gbm9kZXMgYXJlIGlkZW50aWNhbFxuZnVuY3Rpb24gdW5ob29rKHZOb2RlLCBwYXRjaCwgaW5kZXgpIHtcbiAgICBpZiAoaXNWTm9kZSh2Tm9kZSkpIHtcbiAgICAgICAgaWYgKHZOb2RlLmhvb2tzKSB7XG4gICAgICAgICAgICBwYXRjaFtpbmRleF0gPSBhcHBlbmRQYXRjaChcbiAgICAgICAgICAgICAgICBwYXRjaFtpbmRleF0sXG4gICAgICAgICAgICAgICAgbmV3IFZQYXRjaChcbiAgICAgICAgICAgICAgICAgICAgVlBhdGNoLlBST1BTLFxuICAgICAgICAgICAgICAgICAgICB2Tm9kZSxcbiAgICAgICAgICAgICAgICAgICAgdW5kZWZpbmVkS2V5cyh2Tm9kZS5ob29rcylcbiAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICApXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodk5vZGUuZGVzY2VuZGFudEhvb2tzIHx8IHZOb2RlLmhhc1RodW5rcykge1xuICAgICAgICAgICAgdmFyIGNoaWxkcmVuID0gdk5vZGUuY2hpbGRyZW5cbiAgICAgICAgICAgIHZhciBsZW4gPSBjaGlsZHJlbi5sZW5ndGhcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgICAgICAgICB2YXIgY2hpbGQgPSBjaGlsZHJlbltpXVxuICAgICAgICAgICAgICAgIGluZGV4ICs9IDFcblxuICAgICAgICAgICAgICAgIHVuaG9vayhjaGlsZCwgcGF0Y2gsIGluZGV4KVxuXG4gICAgICAgICAgICAgICAgaWYgKGlzVk5vZGUoY2hpbGQpICYmIGNoaWxkLmNvdW50KSB7XG4gICAgICAgICAgICAgICAgICAgIGluZGV4ICs9IGNoaWxkLmNvdW50XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChpc1RodW5rKHZOb2RlKSkge1xuICAgICAgICB0aHVua3Modk5vZGUsIG51bGwsIHBhdGNoLCBpbmRleClcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHVuZGVmaW5lZEtleXMob2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9XG5cbiAgICBmb3IgKHZhciBrZXkgaW4gb2JqKSB7XG4gICAgICAgIHJlc3VsdFtrZXldID0gdW5kZWZpbmVkXG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdFxufVxuXG4vLyBMaXN0IGRpZmYsIG5haXZlIGxlZnQgdG8gcmlnaHQgcmVvcmRlcmluZ1xuZnVuY3Rpb24gcmVvcmRlcihhQ2hpbGRyZW4sIGJDaGlsZHJlbikge1xuICAgIC8vIE8oTSkgdGltZSwgTyhNKSBtZW1vcnlcbiAgICB2YXIgYkNoaWxkSW5kZXggPSBrZXlJbmRleChiQ2hpbGRyZW4pXG4gICAgdmFyIGJLZXlzID0gYkNoaWxkSW5kZXgua2V5c1xuICAgIHZhciBiRnJlZSA9IGJDaGlsZEluZGV4LmZyZWVcblxuICAgIGlmIChiRnJlZS5sZW5ndGggPT09IGJDaGlsZHJlbi5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBiQ2hpbGRyZW4sXG4gICAgICAgICAgICBtb3ZlczogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTyhOKSB0aW1lLCBPKE4pIG1lbW9yeVxuICAgIHZhciBhQ2hpbGRJbmRleCA9IGtleUluZGV4KGFDaGlsZHJlbilcbiAgICB2YXIgYUtleXMgPSBhQ2hpbGRJbmRleC5rZXlzXG4gICAgdmFyIGFGcmVlID0gYUNoaWxkSW5kZXguZnJlZVxuXG4gICAgaWYgKGFGcmVlLmxlbmd0aCA9PT0gYUNoaWxkcmVuLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgY2hpbGRyZW46IGJDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPKE1BWChOLCBNKSkgbWVtb3J5XG4gICAgdmFyIG5ld0NoaWxkcmVuID0gW11cblxuICAgIHZhciBmcmVlSW5kZXggPSAwXG4gICAgdmFyIGZyZWVDb3VudCA9IGJGcmVlLmxlbmd0aFxuICAgIHZhciBkZWxldGVkSXRlbXMgPSAwXG5cbiAgICAvLyBJdGVyYXRlIHRocm91Z2ggYSBhbmQgbWF0Y2ggYSBub2RlIGluIGJcbiAgICAvLyBPKE4pIHRpbWUsXG4gICAgZm9yICh2YXIgaSA9IDAgOyBpIDwgYUNoaWxkcmVuLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIHZhciBhSXRlbSA9IGFDaGlsZHJlbltpXVxuICAgICAgICB2YXIgaXRlbUluZGV4XG5cbiAgICAgICAgaWYgKGFJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKGJLZXlzLmhhc093blByb3BlcnR5KGFJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBNYXRjaCB1cCB0aGUgb2xkIGtleXNcbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBiS2V5c1thSXRlbS5rZXldXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcblxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBSZW1vdmUgb2xkIGtleWVkIGl0ZW1zXG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gaSAtIGRlbGV0ZWRJdGVtcysrXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChudWxsKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gTWF0Y2ggdGhlIGl0ZW0gaW4gYSB3aXRoIHRoZSBuZXh0IGZyZWUgaXRlbSBpbiBiXG4gICAgICAgICAgICBpZiAoZnJlZUluZGV4IDwgZnJlZUNvdW50KSB7XG4gICAgICAgICAgICAgICAgaXRlbUluZGV4ID0gYkZyZWVbZnJlZUluZGV4KytdXG4gICAgICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChiQ2hpbGRyZW5baXRlbUluZGV4XSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgLy8gVGhlcmUgYXJlIG5vIGZyZWUgaXRlbXMgaW4gYiB0byBtYXRjaCB3aXRoXG4gICAgICAgICAgICAgICAgLy8gdGhlIGZyZWUgaXRlbXMgaW4gYSwgc28gdGhlIGV4dHJhIGZyZWUgbm9kZXNcbiAgICAgICAgICAgICAgICAvLyBhcmUgZGVsZXRlZC5cbiAgICAgICAgICAgICAgICBpdGVtSW5kZXggPSBpIC0gZGVsZXRlZEl0ZW1zKytcbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG51bGwpXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGFzdEZyZWVJbmRleCA9IGZyZWVJbmRleCA+PSBiRnJlZS5sZW5ndGggP1xuICAgICAgICBiQ2hpbGRyZW4ubGVuZ3RoIDpcbiAgICAgICAgYkZyZWVbZnJlZUluZGV4XVxuXG4gICAgLy8gSXRlcmF0ZSB0aHJvdWdoIGIgYW5kIGFwcGVuZCBhbnkgbmV3IGtleXNcbiAgICAvLyBPKE0pIHRpbWVcbiAgICBmb3IgKHZhciBqID0gMDsgaiA8IGJDaGlsZHJlbi5sZW5ndGg7IGorKykge1xuICAgICAgICB2YXIgbmV3SXRlbSA9IGJDaGlsZHJlbltqXVxuXG4gICAgICAgIGlmIChuZXdJdGVtLmtleSkge1xuICAgICAgICAgICAgaWYgKCFhS2V5cy5oYXNPd25Qcm9wZXJ0eShuZXdJdGVtLmtleSkpIHtcbiAgICAgICAgICAgICAgICAvLyBBZGQgYW55IG5ldyBrZXllZCBpdGVtc1xuICAgICAgICAgICAgICAgIC8vIFdlIGFyZSBhZGRpbmcgbmV3IGl0ZW1zIHRvIHRoZSBlbmQgYW5kIHRoZW4gc29ydGluZyB0aGVtXG4gICAgICAgICAgICAgICAgLy8gaW4gcGxhY2UuIEluIGZ1dHVyZSB3ZSBzaG91bGQgaW5zZXJ0IG5ldyBpdGVtcyBpbiBwbGFjZS5cbiAgICAgICAgICAgICAgICBuZXdDaGlsZHJlbi5wdXNoKG5ld0l0ZW0pXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoaiA+PSBsYXN0RnJlZUluZGV4KSB7XG4gICAgICAgICAgICAvLyBBZGQgYW55IGxlZnRvdmVyIG5vbi1rZXllZCBpdGVtc1xuICAgICAgICAgICAgbmV3Q2hpbGRyZW4ucHVzaChuZXdJdGVtKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIHNpbXVsYXRlID0gbmV3Q2hpbGRyZW4uc2xpY2UoKVxuICAgIHZhciBzaW11bGF0ZUluZGV4ID0gMFxuICAgIHZhciByZW1vdmVzID0gW11cbiAgICB2YXIgaW5zZXJ0cyA9IFtdXG4gICAgdmFyIHNpbXVsYXRlSXRlbVxuXG4gICAgZm9yICh2YXIgayA9IDA7IGsgPCBiQ2hpbGRyZW4ubGVuZ3RoOykge1xuICAgICAgICB2YXIgd2FudGVkSXRlbSA9IGJDaGlsZHJlbltrXVxuICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuXG4gICAgICAgIC8vIHJlbW92ZSBpdGVtc1xuICAgICAgICB3aGlsZSAoc2ltdWxhdGVJdGVtID09PSBudWxsICYmIHNpbXVsYXRlLmxlbmd0aCkge1xuICAgICAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgbnVsbCkpXG4gICAgICAgICAgICBzaW11bGF0ZUl0ZW0gPSBzaW11bGF0ZVtzaW11bGF0ZUluZGV4XVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgIC8vIGlmIHdlIG5lZWQgYSBrZXkgaW4gdGhpcyBwb3NpdGlvbi4uLlxuICAgICAgICAgICAgaWYgKHdhbnRlZEl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgaWYgKHNpbXVsYXRlSXRlbSAmJiBzaW11bGF0ZUl0ZW0ua2V5KSB7XG4gICAgICAgICAgICAgICAgICAgIC8vIGlmIGFuIGluc2VydCBkb2Vzbid0IHB1dCB0aGlzIGtleSBpbiBwbGFjZSwgaXQgbmVlZHMgdG8gbW92ZVxuICAgICAgICAgICAgICAgICAgICBpZiAoYktleXNbc2ltdWxhdGVJdGVtLmtleV0gIT09IGsgKyAxKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgICAgICAgICAgICAgIHNpbXVsYXRlSXRlbSA9IHNpbXVsYXRlW3NpbXVsYXRlSW5kZXhdXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBpZiB0aGUgcmVtb3ZlIGRpZG4ndCBwdXQgdGhlIHdhbnRlZCBpdGVtIGluIHBsYWNlLCB3ZSBuZWVkIHRvIGluc2VydCBpdFxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKCFzaW11bGF0ZUl0ZW0gfHwgc2ltdWxhdGVJdGVtLmtleSAhPT0gd2FudGVkSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIGl0ZW1zIGFyZSBtYXRjaGluZywgc28gc2tpcCBhaGVhZFxuICAgICAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgc2ltdWxhdGVJbmRleCsrXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBpbnNlcnRzLnB1c2goe2tleTogd2FudGVkSXRlbS5rZXksIHRvOiBrfSlcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgaW5zZXJ0cy5wdXNoKHtrZXk6IHdhbnRlZEl0ZW0ua2V5LCB0bzoga30pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGsrK1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gYSBrZXkgaW4gc2ltdWxhdGUgaGFzIG5vIG1hdGNoaW5nIHdhbnRlZCBrZXksIHJlbW92ZSBpdFxuICAgICAgICAgICAgZWxzZSBpZiAoc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpIHtcbiAgICAgICAgICAgICAgICByZW1vdmVzLnB1c2gocmVtb3ZlKHNpbXVsYXRlLCBzaW11bGF0ZUluZGV4LCBzaW11bGF0ZUl0ZW0ua2V5KSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIHNpbXVsYXRlSW5kZXgrK1xuICAgICAgICAgICAgaysrXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvLyByZW1vdmUgYWxsIHRoZSByZW1haW5pbmcgbm9kZXMgZnJvbSBzaW11bGF0ZVxuICAgIHdoaWxlKHNpbXVsYXRlSW5kZXggPCBzaW11bGF0ZS5sZW5ndGgpIHtcbiAgICAgICAgc2ltdWxhdGVJdGVtID0gc2ltdWxhdGVbc2ltdWxhdGVJbmRleF1cbiAgICAgICAgcmVtb3Zlcy5wdXNoKHJlbW92ZShzaW11bGF0ZSwgc2ltdWxhdGVJbmRleCwgc2ltdWxhdGVJdGVtICYmIHNpbXVsYXRlSXRlbS5rZXkpKVxuICAgIH1cblxuICAgIC8vIElmIHRoZSBvbmx5IG1vdmVzIHdlIGhhdmUgYXJlIGRlbGV0ZXMgdGhlbiB3ZSBjYW4ganVzdFxuICAgIC8vIGxldCB0aGUgZGVsZXRlIHBhdGNoIHJlbW92ZSB0aGVzZSBpdGVtcy5cbiAgICBpZiAocmVtb3Zlcy5sZW5ndGggPT09IGRlbGV0ZWRJdGVtcyAmJiAhaW5zZXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGNoaWxkcmVuOiBuZXdDaGlsZHJlbixcbiAgICAgICAgICAgIG1vdmVzOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgICBjaGlsZHJlbjogbmV3Q2hpbGRyZW4sXG4gICAgICAgIG1vdmVzOiB7XG4gICAgICAgICAgICByZW1vdmVzOiByZW1vdmVzLFxuICAgICAgICAgICAgaW5zZXJ0czogaW5zZXJ0c1xuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUoYXJyLCBpbmRleCwga2V5KSB7XG4gICAgYXJyLnNwbGljZShpbmRleCwgMSlcblxuICAgIHJldHVybiB7XG4gICAgICAgIGZyb206IGluZGV4LFxuICAgICAgICBrZXk6IGtleVxuICAgIH1cbn1cblxuZnVuY3Rpb24ga2V5SW5kZXgoY2hpbGRyZW4pIHtcbiAgICB2YXIga2V5cyA9IHt9XG4gICAgdmFyIGZyZWUgPSBbXVxuICAgIHZhciBsZW5ndGggPSBjaGlsZHJlbi5sZW5ndGhcblxuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICAgICAgdmFyIGNoaWxkID0gY2hpbGRyZW5baV1cblxuICAgICAgICBpZiAoY2hpbGQua2V5KSB7XG4gICAgICAgICAgICBrZXlzW2NoaWxkLmtleV0gPSBpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBmcmVlLnB1c2goaSlcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICAgIGtleXM6IGtleXMsICAgICAvLyBBIGhhc2ggb2Yga2V5IG5hbWUgdG8gaW5kZXhcbiAgICAgICAgZnJlZTogZnJlZSAgICAgIC8vIEFuIGFycmF5IG9mIHVua2V5ZWQgaXRlbSBpbmRpY2VzXG4gICAgfVxufVxuXG5mdW5jdGlvbiBhcHBlbmRQYXRjaChhcHBseSwgcGF0Y2gpIHtcbiAgICBpZiAoYXBwbHkpIHtcbiAgICAgICAgaWYgKGlzQXJyYXkoYXBwbHkpKSB7XG4gICAgICAgICAgICBhcHBseS5wdXNoKHBhdGNoKVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXBwbHkgPSBbYXBwbHksIHBhdGNoXVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIGFwcGx5XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHBhdGNoXG4gICAgfVxufVxuIiwidmFyIG5hdGl2ZUlzQXJyYXkgPSBBcnJheS5pc0FycmF5XG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbm1vZHVsZS5leHBvcnRzID0gbmF0aXZlSXNBcnJheSB8fCBpc0FycmF5XG5cbmZ1bmN0aW9uIGlzQXJyYXkob2JqKSB7XG4gICAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gXCJbb2JqZWN0IEFycmF5XVwiXG59XG4iLCJpbXBvcnQgTWFpblZpZXcgIGZyb20gJy4vdmlld3MvTWFpblZpZXcnO1xyXG5cclxuZnVuY3Rpb24gbW9kdWxlRmFjdG9yeShvcHRzLCBwdWJzdWIpe1xyXG5cdFxyXG5cdHZhciBNT0RUWVBFID0ge1xyXG5cdFx0J2RlZmF1bHQnIFx0OiBNYWluVmlld1xyXG5cdH07XHJcblxyXG5cdC8vIE9idGVuZW1vcyBsb3MgYXRyaWJ1dG9zIGRhdGFzIGRlbCBtw7NkdWxvXHJcblx0dmFyIGRhdGFzID0gb3B0cy5lbC5kYXRhKCk7XHJcblxyXG5cdC8vIFNpIHZpZW5lIGVsIGNhbmFsIFBVQlNVQiBsbyBpbmNsdcOtbW9zXHJcblx0aWYocHVic3ViKSBvcHRzLnB1YnN1YiA9IHB1YnN1YjtcclxuXHJcblx0Ly8gRGV2b2x2ZW1vcyBsYSBpbnN0YW5jaWFcclxuXHRpZighZGF0YXMudGhlbWUpeyBcclxuXHRcdHJldHVybiBuZXcgTU9EVFlQRVsgJ2RlZmF1bHQnIF0ob3B0cyk7XHJcblx0fVxyXG5cdFxyXG5cdC8vIFNpIHRlbmVtb3MgcXVlIGRldm9sdmVyIHVuYSBpbnN0YW5jaWEgZGUgdW5hIHZpc3RhIGRlIGZvcm1hIGRpbsOhbWljYVxyXG5cdHJldHVybiAoIE1PRFRZUEVbIGRhdGFzLnRoZW1lLnRvTG93ZXJDYXNlKCkgXSkgPyBcclxuXHRcdG5ldyBNT0RUWVBFWyBkYXRhcy50aGVtZS50b0xvd2VyQ2FzZSgpIF0ob3B0cykgOiBcclxuXHRcdG5ldyBNT0RUWVBFWyAnZGVmYXVsdCcgXShvcHRzKTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbW9kdWxlRmFjdG9yeTsiLCJcclxudmFyIGRpZmYgPSByZXF1aXJlKCd2aXJ0dWFsLWRvbS9kaWZmJyk7XHJcbnZhciBwYXRjaCA9IHJlcXVpcmUoJ3ZpcnR1YWwtZG9tL3BhdGNoJyk7XHJcbnZhciBjcmVhdGVFbGVtZW50ID0gcmVxdWlyZSgndmlydHVhbC1kb20vY3JlYXRlLWVsZW1lbnQnKTtcclxudmFyIHBhcnNlciA9IHJlcXVpcmUoJ3Zkb20tcGFyc2VyJyk7XHJcblxyXG52YXIgTWFpblZpZXcgPSBCYWNrYm9uZS5WaWV3LmV4dGVuZCh7XHRcclxuXHRcclxuXHRwdWJzdWIgXHRcdDogXy5leHRlbmQoe30sIEJhY2tib25lLkV2ZW50cyksXHJcblxyXG5cdGluaXRpYWxpemU6IGZ1bmN0aW9uKG9wdHMpe1xyXG5cdFx0aWYob3B0cyl7IF8uZXh0ZW5kKHRoaXMsIG9wdHMpOyB9XHRcdFxyXG5cdFx0dGhpcy5wcmVSZW5kZXIoKTtcclxuXHRcdHZhciBjb3VudCA9IDA7XHJcblx0XHR2YXIgaW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKT0+e1xyXG5cdFx0XHRpZihjb3VudD4xMCl7IGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpOyB9XHJcblx0XHRcdHRoaXMucmVuZGVyKCcvbWludXRvYW1pbnV0bz9wYWdlPScrKCsrY291bnQpKTtcclxuXHRcdH0sNTAwMCk7XHJcblx0fSxcclxuXHJcblx0cHJlUmVuZGVyOiBmdW5jdGlvbigpe1xyXG5cdFx0dGhpcy5tYWluTm9kZSA9IHRoaXMuJGVsWzBdO1xyXG5cdFx0XHJcblx0fSxcclxuXHJcblx0cmVuZGVyOiBmdW5jdGlvbih1cmwpe1xyXG5cdFx0JC5nZXQodXJsKS50aGVuKCB0aGlzLnBhdGNoQ29udGVudC5iaW5kKHRoaXMpICk7XHJcblx0XHRyZXR1cm4gdGhpcztcclxuXHR9LCBcclxuXHRwYXRjaENvbnRlbnQ6IGZ1bmN0aW9uKGRhdGEpe1xyXG5cdFx0dmFyIG5ld05vZGUgPSB0aGlzLm1haW5Ob2RlLmNsb25lTm9kZSgpO1xyXG5cdFx0Y29uc29sZS5sb2cobmV3Tm9kZSk7XHJcblx0XHRuZXdOb2RlLmlubmVySFRNTCA9IGRhdGE7XHJcblx0XHR2YXIgbmV3Tm9kZVZET00gPSBwYXJzZXIoIG5ld05vZGUgKTtcclxuXHJcblx0XHR0aGlzLm1haW5Ob2RlVkRPTSA9IHBhcnNlciggdGhpcy5tYWluTm9kZSApO1xyXG5cdFx0dmFyIHBhdGNoZXMgPSBkaWZmKCB0aGlzLm1haW5Ob2RlVkRPTSwgbmV3Tm9kZVZET00gKTtcclxuXHRcdGNvbnNvbGUubG9nKHBhdGNoZXMpO1xyXG5cdFx0XHJcblx0XHR0aGlzLm1haW5Ob2RlID0gcGF0Y2goIHRoaXMubWFpbk5vZGUsIHBhdGNoZXMgKTtcclxuXHR9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgTWFpblZpZXc7Il19
