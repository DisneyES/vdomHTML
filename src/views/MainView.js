
var diff = require('virtual-dom/diff');
var patch = require('virtual-dom/patch');
var createElement = require('virtual-dom/create-element');
var parser = require('vdom-parser');

var MainView = Backbone.View.extend({	
	
	pubsub 		: _.extend({}, Backbone.Events),

	initialize: function(opts){
		if(opts){ _.extend(this, opts); }		
		this.preRender();
		var count = 0;
		var interval = setInterval(()=>{
			if(count>10){ clearInterval(interval); }
			this.render('/minutoaminuto?page='+(++count));
		},5000);
	},

	preRender: function(){
		this.mainNode = this.$el[0];
		
	},

	render: function(url){
		$.get(url).then( this.patchContent.bind(this) );
		return this;
	}, 
	patchContent: function(data){
		var newNode = this.mainNode.cloneNode();
		console.log(newNode);
		newNode.innerHTML = data;
		var newNodeVDOM = parser( newNode );

		this.mainNodeVDOM = parser( this.mainNode );
		var patches = diff( this.mainNodeVDOM, newNodeVDOM );
		console.log(patches);
		
		this.mainNode = patch( this.mainNode, patches );
	}
});

export default MainView;