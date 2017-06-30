//
// User editor view
//
define([
    "i18n",
    "text!templates/user/editor.html"
], function(i18n, template) {
    console.log('views/user/editor.js');
    var View = Backbone.View.extend({
        initialize: function(options) {
            this.templates = _.parseTemplate(template);
            // User model
            var User = Backbone.Model.extend({
                urlRoot: 'user'
            });
            this.model = new User();
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
                height: 500,
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
                    self.$Tabs.tabs('select', 0);
                    if (self.model.get('_id')) self.model.fetch({
                        success: function(model) {
                            var m = model.toJSON();
                            m.active = String(m.active);
                            self.$Form.form('load', m);
                        }
                    });
                }
            });
            this.$Dialog = $(dialog);
            this.$Tabs = this.$('.easyui-tabs');
            this.$Form = this.$('.user-form');
            this.$Gender = this.$Form.find('.gender');
            this.$Password = this.$Form.find('.password');
            this.$Citizenship = this.$Form.find('.citizenship');
            this.$DocumentType = this.$Form.find('.documentType');
            this.setTemplateData();
            return this;
        },
        setTemplateData: function() {
            var self = this;
            var setData = function (pattern,container) {
                var keys = Object.keys(i18n.phrases).filter(function(obj){ return obj.indexOf(pattern) >= 0; });
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
            setData('countries.',self.$Citizenship);
            // set gender
            setData('user.genders.',self.$Gender);
            // set document types
            setData('user.documentTypes.',self.$DocumentType);
        },
        doSave: function() {
            if (!this.$Form.form('validate')) return;
            var self = this;
            var config = {};
            this.$Form.serializeArray().map(function(item) {
                if (item.value === "null" || item.value === "") item.value = null;
                // set config
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
            this.model.save(config, {
                success: function(model) {
                    self.callback();
                    self.doClose();
                }
            });
        },
        doOpen: function(userId, callback) {
            this.callback = callback;
            this.model.clear();
            if (userId) {
                this.model.set('_id', userId);
                this.$Password.textbox('disableValidation');
            }
            else this.$Password.textbox('enableValidation');
            this.$Form.form('clear');
            this.$Dialog.dialog('open');
        },
        doClose: function() {
            this.$Dialog.dialog('close');
        }
    });
    return View;
});