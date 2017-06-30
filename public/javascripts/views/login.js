//
// Login view
//
define([
    "i18n",
    "text!templates/login.html"
], function(i18n, template) {
    console.log('views/login.js');
    var View = Backbone.View.extend({
        events: {
            "click input[type='submit']": "submit",
            "click .lang-item": "setLanguage",
        },
        initialize: function() {
            this.templates = _.parseTemplate(template);
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
            this.$el.html(tpl(data));
            $.parser.parse(this.$el);
            // jQuery selectors
            this.$Form = this.$("form#auth-plain");
            this.$Username = this.$(".username");
            this.$Password = this.$(".password");            
            this.resetForm();
            return this;
        },
        getUsername: function() {
            return this.$Username.textbox('getValue');
        },
        getPassword: function() {
            return this.$Password.textbox('getValue');
        },
        resetForm: function() {
            this.$Form.form("reset");
            this.$Username.next().find("input").focus();
        },
        setLanguage: function(e) {
            var itemClasses = $(e.target).attr("class");
            if (itemClasses.indexOf("country-flag") >= 0) {
                LANG = itemClasses.replace("country-flag ","");
            }
            else {
                itemClasses = $(e.target).find("img").attr("class");
                LANG = itemClasses.replace("country-flag ","");
            }
            Cookies.set("itmoproctorLang",LANG);
            document.location.reload();
        },
        submit: function(e) {
            e.preventDefault();
            var self = this;
            app.login(this.getUsername(), this.getPassword(),
                function() {
                    self.resetForm();
                });
            return false;
        }
    });
    return View;
});