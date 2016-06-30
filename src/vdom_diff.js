import MainView  from './views/MainView';

function moduleFactory(opts, pubsub){
	
	var MODTYPE = {
		'default' 	: MainView
	};

	// Obtenemos los atributos datas del módulo
	var datas = opts.el.data();

	// Si viene el canal PUBSUB lo incluímos
	if(pubsub) opts.pubsub = pubsub;

	// Devolvemos la instancia
	if(!datas.theme){ 
		return new MODTYPE[ 'default' ](opts);
	}
	
	// Si tenemos que devolver una instancia de una vista de forma dinámica
	return ( MODTYPE[ datas.theme.toLowerCase() ]) ? 
		new MODTYPE[ datas.theme.toLowerCase() ](opts) : 
		new MODTYPE[ 'default' ](opts);
}

export default moduleFactory;