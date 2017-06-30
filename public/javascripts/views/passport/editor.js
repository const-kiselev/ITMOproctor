//
// PassportEditor view
//
define([
    "i18n",
    "text!templates/passport/editor.html"
], function(i18n, template) {
    console.log('views/passport/editor.js');
    var View = Backbone.View.extend({
        initialize: function(options) {
            this.templates = _.parseTemplate(template);
            this.render();
        },
        destroy: function() {
            this.remove();
        },
        render: function() {
            var self = this;
            var tpl = _.template(this.templates['main-tpl']);
            var data = {
                i18n: i18n
            };
            var dialog = $(this.el).dialog({
                title: i18n.t('user.title'),
                width: 500,
                height: 480,
                closed: true,
                modal: true,
                content: tpl(data),
                buttons: [{
                    text: i18n.t('user.save'),
                    iconCls: 'fa fa-check',
                    handler: function() {
                        self.doSave();
                    }
                }, {
                    text: i18n.t('user.close'),
                    iconCls: 'fa fa-times',
                    handler: function() {
                        self.doClose();
                    }
                }],
                onOpen: function() {
                    $(this).dialog('center');
                    self.$Form.form('load', app.profile.toJSON());
                },
                onClose: function() {
                    self.$Form.form('clear');
                }
            });
            this.$Dialog = $(dialog);
            this.$Form = this.$('.passport-form');            
            this.$Citizenship = this.$Form.find('.citizenship');
            this.$Gender = this.$Form.find('.gender');
            this.$DocumentType = this.$Form.find('.documentType');
            this.setTemplateData();
            return this;
        },
        setTemplateData: function() {
            var self = this;
            var setData = function (keys,pattern,container) {
                if (keys) {
                    var data = [];
                    keys.forEach(function(elem){
                        var code = elem.replace(pattern,'');
                        data.push({
                            code: code,
                            value: i18n.phrases[elem]
                        });
                    });
                    container.combobox('loadData',data);
                }
            };
            // set countries
            var countriesKeys = Object.keys(i18n.phrases).filter(function(obj){ return obj.indexOf('countries') >= 0; });
            setData(countriesKeys,'countries.',self.$Citizenship);
            // set gender
            var genderKeys = Object.keys(i18n.phrases).filter(function(obj){ return obj.indexOf('user.genders') >= 0; });
            setData(genderKeys,'user.genders.',self.$Gender);
            // set document types
            var docTypeKeys = Object.keys(i18n.phrases).filter(function(obj){ return obj.indexOf('user.documentTypes') >= 0; });
            setData(docTypeKeys,'user.documentTypes.',self.$DocumentType);
        },
        doSave: function() {
            if (!this.$Form.form('validate')) return;
            var self = this;
            var config = {};
            this.$Form.serializeArray().map(function(item) {                
                if (config[item.name]) {
                    if (typeof(config[item.name]) === "string") {
                        config[item.name] = [config[item.name]];
                    }
                    config[item.name].push(item.value);
                }
                else {
                    config[item.name] = item.value;
                }
            });
            app.profile.save(config, {
                success: function(model) {
                    self.doClose();
                }
            });
        },
        doOpen: function() {
            this.$Dialog.dialog('open');
        },
        doClose: function() {
            this.$Dialog.dialog('close');
        }
    });
    return View;
});