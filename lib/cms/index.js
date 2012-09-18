//libs
var util = require('util');
var fs = require('fs');
var jade = require('jade');
var _ = require('underscore');
var async = require('async');
var path = require('path');
var mongoose = require('mongoose');
var formidable = require('formidable');
var crypto = require('crypto');
var jade_browser = require('jade-browser');

//settings
var db = mongoose.createConnection('localhost','cms');

//application settings
var app_settings = {
	url: '/cms',
	upload_directory: __dirname + "/../../public/files/",
	templates_dir: __dirname + "/templates/",
	views:  __dirname +  '/views/',
	password_salt: '56 laari'
}
app_settings['templates_url'] = app_settings['url'] +  "/templates.js";


var settings = {};
var mongooseMap = {
	string:'string',
	string_thaana:'string',
	string_thaana_textbox:'string',
	image:'string',
	file:'string'
}
var snapshot_schema  = {
	_ip:'string',
	_date: {type:'date', default: new Date() }
}

var user_schema = {
	user:'string',
	realname:'string',
	password:{type:'string', default:'password'},
	type: 'string', //normal poweruser administrator
	allowed:[], //features allowed
	banned:{type:'boolean', default: false},
	created: {type:'date', default: new Date()}
}

function hashPassword(password){
	return crypto.createHash("sha1").update(password + app_settings.password_salt).digest("hex");
}

function hashMatch(hash, password){
	return hashPassword(password) === hash;
}

function createUser(user, realname, password, type, callback){
	var user = user.trim().toLowerCase(),
		userTest = user.match(/^[a-z]+$/);
	if(userTest == null){
		callback("Incorrect username supplied");
		return;
	}
	userExists(user, function(err, exists){
		if(exists)
			callback("user already exists");
		else{
			var newUser = new cms.users({user:user, realname:realname, password:hashPassword(password), type:type});
			newUser.save(function(err){
				if(err)
					throw Error(err);
				callback(null, "User created");
			});
		}
	});
}

function userExists(user, callback){
	if (featureExists('users') == false){
		callback('User module not initialized');
		return;
	}
	cms['users'].findOne({user:user},function(err,doc){
		if(err) throw Error(err);
		if(doc)
			callback(null, true);
		else
			callback(null, false);
	});
}

function setupUsers(){
	//create users if not exists
	if (featureExists('user') == true){
		return;
	}
	var schema = mongoose.Schema(user_schema);
	cms['users'] = db.model('users',schema);
	
	//add administrator if not exist
	userExists('administrator',function(err, exist){
		if(exist == false){
			createUser('administrator', 'Administrator', 'pass', 'administrator',function(err, res){
				
			});
		}
	});
}

function keyValidate(obj,arr){
	var ok = true;
	arr.forEach(function(e){
		if(!_.has(obj,e))
			ok = false;
	});
	return ok;
}

function verifyFeature(feature, data){
	var extract = settings[feature]['local'];
	var ok = true;
	_.keys(data).forEach(function(e){
		if(e in extract == false)
			ok = false;
	});
	return ok
}

function saveFile(req,options,callback){
	console.log();
	var form = new formidable.IncomingForm();
	form.uploadDir = path.normalize(app_settings.upload_directory);
	form
	.on('file',function(name,file){
		console.log("Creating new file " + name + " ("+bytesToSize(file.size)+")");
	})
	.on('fileBegin',function(name,file){
		file.path = form.uploadDir + crypto.createHash("sha1").update(String(Math.random()+name)).digest("hex") + "."+ (name.split(".").pop());
	})
	.on('field',function(name,val){
		//console.log(name, val);
	})
	.parse(req,callback);
}

function expectFileOperation(feature){
	var extract = settings[feature]['local'];
	var ok = false;
	for(var i in extract){
		if('image file'.indexOf(extract[i]['type']) !== -1){
			ok = true;
			return ok;
		}
	}
	return ok;
}

function bytesToSize(bytes) {
	var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
	if (bytes == 0) return 'n/a';
	var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
	return Math.round(bytes / Math.pow(1024, i), 2) + ' ' + sizes[i];
};

function sanitizeFields(feature,fields){
	extract = settings[feature]['local'];
	var ret = {};
	for(var i in fields){
		if(i in extract)
			ret[i] = fields[i]
	}
	return ret;
}


function validateUser(userObj, callback){
	var user = userObj.user;
	var password = userObj.password;
	cms.users.findOne({user:user},function(err,doc){
		if(err) throw Error(err);
		if(doc){
			if(password === doc.password){
				return callback(null, true, doc);
			}
			console.log(password, doc.password)
			return callback("Password incorrect", false);
		}
		return callback("User doesn't exist", false);
	});
}

function addRoutes(){
	var app = cms.app;
	var url = app_settings.url;
	app.post(url + '/login',function(req,res){

		var user = {user:req.body.username, password:hashPassword(req.body.password)};
		validateUser(user,function val(err, validated, user){
			if(!validated) return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade', msg:err});
			req.session.user = {
				user:user.user,
				password:user.password
			};
			res.redirect(url);
		});
	});
	app.get(url + '/logout',function(req,res){
		req.session.destroy();
		res.redirect(app_settings.url + '/login');
	});
	app.all(url + "/*", function(req,res, next){
		if(typeof req.session == 'undefined')
			throw Error("Session not started");
		if(typeof req.session.user == 'undefined'){
			if(req.xhr){
				return res.json({error:"Please login"});
			}
			return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade'});
		}
		/*
			return next() will skip  validateUser() because async operation hangs uploads 
			in formidable.
		*/
		
		validateUser(req.session.user, function(err, validated){
			return next();
			if(err) {
				if(req.xhr){
					return res.json({error:err});
				}
				return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade', msg:err});
			}
			if(validated){
				return next();
			}
			if(req.xhr){
				return res.json({error:"Unable to validate you"});
			}
			return res.render(app_settings.views + 'login.jade',{layout: app_settings.views + 'layout.jade', msg:"Unable to validate you"});

		});
	});
	app.get(url, function(req,res){
		res.render(app_settings.views + 'index.jade',{menus:cms.pageStructure(), layout: app_settings.views + 'layout.jade'});
	});
	app.get(app_settings['templates_url'], function(req,res,next){
		jade_browser(app_settings.templates_url, '**', {root:app_settings.templates_dir, minify: true})(req,res,next);
	});

	app.get(url + "/:feature",function(req,res){
		var feature = req.params.feature;
		cms.get(feature,function(err,docs){
			if(err){
				console.log(err);
				res.json({error:err});
			}else{
				res.json(docs);
			}
		});
	});
	
	app.post(url + '/:feature/:command', function(req,res){
		console.log('here');
		var feature = req.params.feature;
		var command = req.params.command;
		var data = req.body;
		cms.execute(feature,command,data,req,function(err, result){
			res.json(result);
		});
	});
	
	app.post(url + '/remove-component',function(req,res){
		var feature = req.body.feature;
		var id = req.body.id;
		if(typeof cms[feature] != 'function') res.json({error:"Unable to complete your request"});
		else{
			cms[feature].remove({_id:id},function(err,docs){
				if (err) res.json({error:"There was an error occured while removing"});
				else res.json({removed:docs, message:"Successfully removed component" + (docs > 1 ? "s" : "")});
			});
		}
	});
}

function featureExists(feature){
	return typeof cms[feature] == 'function';
}

function createSnapshot(feature, id, callback){
	if(!featureExists(feature)){
		callback("Feature doesn't exist!");
		return;
	} 
	cms[feature].findOne({_id:id}, function(err,doc){
		var snap = _.clone(JSON.parse(JSON.stringify(doc)));
		delete snap._id;
		delete snap['__v'];
		delete snap['snapshot'];
		doc.snapshot.push(snap);
		doc.save(callback);
	});
}
function removeKeys(keys,obj){
	var newObject = {};
	for(var key in obj){
		if(!key in obj){
			newObject[key] = obj[key];
		}
	}
}
function getSchema(feature){
	var schema = {};
	for(var i in settings[feature].local){
		schema[i] = {type:settings[feature].local[i]['type']}
	}
	return schema;
}
var cms = module.exports = {
	app:null,
	listen:function(app){
		cms.app = app;
		addRoutes();
		setupUsers();
	},
	router:function router(req,res,next){
		
	},
	add:function add(feature,obj){
		if(feature in settings) throw new Error ("Feature "+ feature +" already exists");
		settings[feature] = {};
		var mongoose_data = {};
		for(var i in obj){
			if('type' in obj[i] == false) throw new Error("Could not find 'type' of " + i);
			
			switch(obj[i]['type']){
				case "image":
					if(!keyValidate(obj[i], ["folder"]))
						throw new Error("Keys not set'");
					break;
			}
			mongoose_data[i] = mongooseMap[obj[i]['type']];
			
		}
		
		var snapshot = new mongoose.Schema(_.extend(JSON.parse(JSON.stringify(mongoose_data)), snapshot_schema));
		mongoose_data.snapshot = [snapshot]; 
		settings[feature].local = obj
		settings[feature].mongoose = mongoose.Schema(mongoose_data);
		
		//create mongoose model
		cms[feature] = db.model(feature,settings[feature].mongoose);
		//console.log(util.inspect(settings,true,2,true));
	},
	execute:function execute (feature,cmd,additional,req,callback){
		//cmd = new, update, delete, edit
		//expect quote and an image
		if(feature in settings == false){
			callback("Undefined feature " + feature + ".");
			return;
		}
		if("add update remove".indexOf(cmd) === -1){
			callback("Method '" + cmd + "' is invalid, please make sure to request with 'add, update or remove'.");
			return;
		}
		if(!req){
			callback("Request not supplied");
			return;
		}
		/*if(!verifyFeature(feature,data)){
			callback("Data mismatch, please ensure that you supply enough data.");
			return;
		}*/
		if(expectFileOperation(feature)){
			saveFile(req,null,function(err,fields,files){
				console.log(fields);
				//replace file/images.. fields in field list with file paths
				var data = sanitizeFields(feature,fields);
				for(var i in data){
					if(data[i] in files === true){
						data[i] = files[data[i]]['path'].split('/').pop();
					}
				}
				
				var operation = {fields:fields, cmd:cmd, feature:feature, data:data, callback:callback};
				cms.executeOperation(operation);
				
			});	
		}else{
			var form = new formidable.IncomingForm();
			form.parse(req,function(err,fields,files){
				var data = sanitizeFields(feature,fields);
				for(var i in data){
					if(data[i] in files === true){
						data[i] = path.normalize(files[data[i]]['path']);
					}
				}
				var operation = {fields:fields, cmd:cmd, feature:feature, data:data, callback:callback};
				cms.executeOperation(operation);
			});
		}
		
	},
	executeOperation:function executeOperation(obj){
		if(obj.cmd == 'update'){
			//expects obj.fields to hold data 'id'
			var id = obj.fields.id;
			
			if(typeof id == 'undefined'){
				obj.callback("no id found to update");
				return;
			}
			
			cms.update(obj.feature, id, obj.data,function(err, doc){
				if(err){
					obj.callback(err);
					return;
				}
				
				cms[obj.feature].findOne({_id:id},function(err,doc){
					var schema = getSchema(obj.feature);
					obj.callback(null, {schema: schema , docs:doc});				
				});
				
			});
		}
		
		if(obj.cmd == "add"){
			cms.save(obj.feature, obj.data, obj.callback);
		}
	},
	save:function save(feature,data,callback){
		var document = new cms[feature](data);
		document.save(callback);
	},
	update:function update(feature, id, data, callback){
		createSnapshot(feature, id,function(err){
			if(err){
				callback("Unable to create a snapshot");
				return;
			}
			cms[feature].update({_id:id},{$set:data}, callback);
		});
	},
	pageStructure:function generateMainPages(){
		return _.groupBy(_.keys(settings),function(e){return e.split("_")[0]});
	},
	get:function get(feature,callback){
		module.exports[feature].find({},function(err,docs){
			if(err){
				callback(err);
				return;
			}
			var schema = getSchema(feature);
			callback(null, {feature:feature, schema: schema , docs:docs});
		});
	},
	prepare:function prepare(page,callback){
		var collect = [];
		for(var i in settings){
			if(i.indexOf(page) !== 0)	
				continue;
			collect.push(i);
		}
		async.map(collect, cms.get, function(err, results){
			var obj = {};
			results.forEach(function(r){
				obj[r['feature']] = r['docs'];
			});
			callback(null, obj);
		});
	}
}

process.nextTick(function(){
	//setupUsers();
	//module.exports.pageStructure();
	//exports.app.use(jade_browser('/js/templates.js', '**',{root:settings.templates_dir}));

});
//process.on('uncaughtException',console.log);
