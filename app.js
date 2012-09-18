
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes');
var RedisStore = require('connect-redis')(express);

var app = module.exports = express.createServer();
delete express.bodyParser.parse['multipart/form-data'];

var cms = require('./lib/cms');


cms.add('homepage_slider',{
	label:{type:'string'},
	image:{type:'image', folder:__dirname, crop:{width:500,height:200}}
});

cms.add('homepage_people',{
	firstname:{type:'string'},
	lastname:{type:'string'},
	address:{type:'string'},
	photo:{type:'image', folder:__dirname, crop:{width:500,height:200}}
});

cms.add('contact',{
	firstname:{type:'string'}
});

cms.add('about_information',{
	desc:{type:'string'},
	photo:{type:'image', folder:__dirname, crop:{width:500,height:200}}
});

cms.add('news_dhivehi',{
	title:{type:'string_thaana_textbox'},
	photo:{type:'image', folder:__dirname, crop:{width:500,height:200}},
	article:{type:'string_thaana'}
});

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  //app.use(express.logger());
  app.use(express.cookieParser("herro"));
  app.use(express.bodyParser())
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(express.static(__dirname + '/public'));
  app.use(express.session({secret:"herro",store: new RedisStore, cookie: { maxAge: 600000000 ,httpOnly: false, secure: false}}));
  app.use(app.router);

});
cms.listen(app);

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes
app.get('/',function(req,res){
	cms.prepare('homepage',function(err, page){
		res.json(require('util').inspect(page, true, 5));
	});
}),

app.get('/',function(req,res){
	
});
/*

*/
app.listen(3017, function(){
  console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});
