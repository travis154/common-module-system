$(function(){
	$('.cms-load').on('click','li',function(e){
		var self = $(this);
		var name = self.attr('cms-name');
		$('.menu-selected').removeClass('menu-selected');
		self.addClass('menu-selected');
		
		cms.fetch(name, function(res){
			var schema = res.schema;
			cms.clearComponents();
			cms.addComponents(res,name);
			cms.addComponent('new-item',null,schema);
			cms.makeReady(name);
		});
	});
	$("#cms-item-add").live('click',function(e){
		var feature = $(this).attr('cms-feature');
		cms.addNew(feature, $(this), "add");
	});
	$(".cms-remove").live('click',function(){
		var self = $(this),
		feature = self.attr('cms-feature'),
		id = self.attr('cms-id');
		
		if(confirm("Are you sure you want to remove this")){
			cms.remove(feature,id);
			var elem = $(this).parentsUntil('.accordion-group').parent().parent()[0];	
			$(elem).slideUp(function(){
				$(this).remove();
			});
		}
	});
	$(".cms-update").live('click',function(){
		var self = $(this).parentsUntil('.accordion-group').parent().parent()[0];
		console.log(self);
		var feature = $(this).attr('cms-feature');
		cms.addNew(feature, $(this), "update", function(err, res){
			var data = JSON.parse(res);
			var doc = data.docs;
			var dom = cms.renderComponent('item', {id:feature + "_" + doc._id , _id:doc._id, feature:feature,}, data.schema, doc);
			$(self).replaceWith(dom);
			$(dom).find('.accordion-toggle').trigger('click');
		});
	});
});

var cms = {
	settings:{
		components:"#components",
		dom_types:{
			image:'<input type="file" />',
			file:'<input type="file" />',
			string:'<input type="text" />',
			string_thaana:'<textarea class="thaana thaana-textarea"></textarea>',
			string_thaana_textbox:'<input class="thaana" type="text">'
		}
	},
	fetch:function fetch(feature, callback){
		$.getJSON("/cms/" + feature, callback);
	},
	renderComponent:function renderComponent(template, options, schema, data){
		var dom = $(jade.render(template, options || {}));
		for(var i in schema){
			var field = typeof data === 'undefined' ? cms.renderField(i,schema[i].type): cms.renderField(i,schema[i].type, data[i]);
			dom.find('.cms-elems').append(field);
		}
		return dom;
	},
	addComponent:function addComponent(template, options, schema, data){
		var html = cms.renderComponent(template, options, schema, data);
		console.log(html);
		$(cms.settings.components).append(html);
	},
	addComponents:function addComponents(components,feature){
		_.each(components.docs,function(e,i){
			cms.addComponent('item',{id:feature + "_" + e._id,_id:e._id,feature:feature},components.schema,e);
		});
	},
	clearComponents:function clearComponents(){
		$(cms.settings.components).html('');
	},
	renderField:function(label,type, data){
		var dom = cms.settings.dom_types[type];
		dom = $(dom);
		dom.attr('cms-name',label);
		dom.attr('cms-type',type);
		var extra = [];
		
		switch(type){
			case "string":
				dom.attr('value',data);
				break;
			case "string_thaana":
				dom.thaana();
				dom.html(data);
				break;
			case "string_thaana_textbox":
				dom.thaana();
				dom.val(data);
				break;
			case "image":
				if(data)
					extra.push(jade.render('image-thumbs',{image:data}));
				break;
		}
		//var html = '<div class="control-group"><label class="control-label">'+ label +'</label><div class="controls">'+ dom[0].outerHTML + extra.join('') +'</div></div>';
		var html = $('<div class="control-group"><label class="control-label">'+ label +'</label><div class="controls"></div></div>');
		html.find('.controls').append(dom);
		html.find('.controls').append(extra.join(''));
		return html;
	},
	makeReady:function(name){
		//set cms-name of 'Add new item' to the feature
		$("#cms-item-add").attr("cms-feature",name);
	},
	getFiles:function(el){
		var form = new FormData();
		var files = el.parent().parent().find(".controls input[type='file']");
		_.each(files,function(filelist){
			var file = filelist.files;
			for(var i = 0; i < file.length; i++)
				form.append(file[i].fileName || file[i].name,file[i]);
		});
		return form;
	},
	makeRequest:function(feature,action,form, callback){
		var xhr = new XMLHttpRequest();
		xhr.open("POST", "/cms/"+ feature +"/" + action, true);
		xhr.send(form);
		
		xhr.addEventListener('readystatechange',function(){
			if(xhr.readyState == 4){
				if(callback){
					callback(null, xhr.response);
				}
			}
		});
	},
	addNew:function(feature,el,type, callback){
		var form = cms.getFiles(el);
		var cms_fields = _.each(el.parent().parent().find("[cms-name]"),function(e){
			var elem = $(e), type = elem.attr('cms-type'), name = elem.attr('cms-name');
			if(type == "string")
				form.append(name, elem.val())
				
			if(type == "string_thaana")
				form.append(name, elem.val())
				
			if(type == "string_thaana_textbox")
				form.append(name, elem.val())
			
			if(type == 'image'){
				if(elem[0].files.length > 0){
					form.append(name, elem[0].files[0].fileName);
				}
			}
		});
		if(type == 'update'){
			form.append('id', el.attr('cms-id'));
		}
		cms.makeRequest(feature,type,form, callback);
	},
	remove:function(feature,id){
		$.post('/cms/remove-component', {feature:feature,id:id}, function(res){
			
		});
	}
}

