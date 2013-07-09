(function (window, document, $, undefined) {
    "use strict";
    $.fluentcomments = function (options, element) {
        this.element = $(element);

        // Flag the object in the event of a failed creation
        if (!this._create(options)) {
            this.failed = true;
        }
    };

    // Settings
    $.fluentcomments.defaults = {
        loading: {
            speed: 'fast',
            selector: '#comment-waiting',
        },
        speed: null,
        listSelector: '#comments',
        formSelector: 'form[data-ajax-action]',
        state: {
            isDuringAjax: false
        },
        scroll: {
            speed: 1000,
            enabled: true,
            selector: 'html, body',
            topOffsetPx: 40,
            previewOffsetPx: 20
        },
        contentSelector: null,
        debug: false
    };


    $.fluentcomments.prototype = {
        // grab each selector option and see if any fail
        _validate: function flucom_validate(opts) {
            return true;
        },

        // Fundamental aspects of the plugin are initialized
        _create: function flucom_create(options) {

            // Add custom options to defaults
            var opts = $.extend(true, {}, $.fluentcomments.defaults, options);
            this.options = opts;
            var $window = $(window);
            var instance = this;

            // Validate selectors
            if (!instance._validate(options)) {
                return false;
            }

            // contentSelector is 'page fragment' option for .load() / .ajax() calls
            opts.contentSelector = opts.contentSelector || this.element;

            this._setup();
            this._bind();

            // Return true to indicate successful creation
            return true;
        },

        _commentFromID: function(id) {
            return $("#c" + id);
        },

        _setup: function() {
            var opts = this.options;

            // Find the element to use for scrolling.
            // This code is much shorter then jQuery.scrollTo()
            $(opts.scroll.selector).each(function() {
                // See which tag updates the scrollTop attribute
                var $rootEl = $(this);
                var initScrollTop = $rootEl.attr('scrollTop');
                $rootEl.attr('scrollTop', initScrollTop + 1);
                if( $rootEl.attr('scrollTop') == initScrollTop + 1 )
                {
                    opts.scroll.selector = this.nodeName.toLowerCase();
                    $rootEl.attr('scrollTop', initScrollTop);  // Firefox 2 reset
                    return false;
                }
            });

            // On load, scroll to proper comment.
            var hash = window.location.hash;
            if( hash.substring(0, 2) == "#c" )
            {
                var id = parseInt(hash.substring(2));
                if( ! isNaN(id))  { // e.g. #comments in URL
                    this.scrollTo(this._commentFromID(id));
                }
            }
        },

        _bind: function () {
            var instance = this,
                    opts = this.options,
                selector = opts.contentSelector;

            var $content = $(opts.contentSelector);
            var $form = $content.find(opts.formSelector);
            var $submitBtn = $form.find('input[type="submit"]');
            var $textarea = $form.find('textarea');

            var run =  function (e) {
                e.preventDefault();
                var comment = $textarea.val();
                if ($.trim(comment).length > 0) {
                    var formData = $form.serialize();
                    instance.beginAjax($form);
                }
            };

            $submitBtn.unbind('click').bind('click', run);

            $form.wrap('<div class="js-comments-form-orig-position"></div>');
        },


        // Console log wrapper
        _debug: function flucom_debug() {
            if (true !== this.options.debug) {
                return;
            }

            if (typeof console !== 'undefined' && typeof console.log === 'function') {
                // Modern browsers
                // Single argument, which is a string
                if ((Array.prototype.slice.call(arguments)).length === 1 && typeof Array.prototype.slice.call(arguments)[0] === 'string') {
                    console.log( (Array.prototype.slice.call(arguments)).toString() );
                } else {
                    console.log( Array.prototype.slice.call(arguments) );
                }
            } else if (!Function.prototype.bind && typeof console !== 'undefined' && typeof console.log === 'object') {
                // IE8
                Function.prototype.call.call(console.log, console, Array.prototype.slice.call(arguments));
            }
        },


        scrollTo: function flucom_scroll($element, offset) {
            var opts = this.options;

            if ( !opts.scroll.enabled ) {
                return;
            }

            // Allow initialisation before scrolling.
            //var $comment = $("#c" + id);
            if( $element.length == 0 ) {
                if( window.console ) {
                    console.warn("scroll element with selector " + $element.selector + "not found.");
                }
                return;
            }

            // What is this?
            // if( window.on_scroll_to_comment && window.on_scroll_to_comment({comment: $comment}) === false )
            //    return;
            $(opts.scroll.selector).animate({
                scrollTop: $element.offset().top - (offset || opts.scroll.topOffsetPx)
            }, opts.scroll.speed);
        },

        _addComment: function flucom_addcomment(data) {
            // data contains the server-side response.
            var instance = this,
                    opts = this.options;
            var html = data['html'];
            var parent_id = data['parent_id'];

            var $new_comment;
            if(parent_id) {
                var $parentLi = $("#c" + parseInt(parent_id)).parent('li.comment-wrapper');
                var $commentUl = $parentLi.children('ul');
                if( $commentUl.length == 0 )
                    $commentUl = $parentLi.append('<ul class="comment-list-wrapper"></ul>').children('ul.comment-list-wrapper');
                $commentUl.append('<li class="comment-wrapper">' + html + '</li>');
            }
            else {
                var $comments = $(opts.contentSelector).find(opts.listSelector);
                $comments.children('.empty-message').hide().fadeOut(600);
                $comments.append(html).removeClass('empty');
            }

            $new_comment =  $("#c" + parseInt(data.comment_id));
            $new_comment.hide().show(opts.speed);


            setTimeout(function() { instance.scrollTo($new_comment) }, 1000);

            return $new_comment;
        },

        beginAjax: function flucom_beginajax($form)   {
            var instance = this,
                    opts = this.options;

            $('div.comment-error').remove();
            if (opts.state.isDuringAjax) {
                return false;
            }

            opts.state.isDuringAjax = true;
            var comment = $form.serialize();
            var url = $form.attr('action') || './';
            var ajaxurl = $form.attr('data-ajax-action');

            // Add a wait animation
            $(opts.loading.selector).fadeIn(opts.loading.speed);

            // Use AJAX to post the comment.
            $.ajax({
                type: 'POST',
                url: ajaxurl || url,
                data: comment,
                dataType: 'json',
                success: function(data) {
                    $(opts.formSelector).find('.js-errors').remove();
                    $(opts.formSelector).find('.control-group.error').removeClass('error');

                    if (data.success) {
                        // remove textarea value
                        $(opts.formSelector).find('textarea').val("");

                        var $new_comment = instance._addComment(data);

                        var $message_span;
                        if( data.is_moderated )
                            $message_span = $("#comment-moderated-message").fadeIn(200);
                        else
                            $message_span = $("#comment-added-message").fadeIn(200);

                        setTimeout(function(){ $message_span.fadeOut(500) }, 4000);
                    }
                    else {
                        instance.commentFailure(data);
                    }
                },
                complete: function(data) {
                    opts.state.isDuringAjax = false;
                    $(opts.loading.selector).hide(opts.loading.speed).stop();
                }
            });

            return false;
        },


        commentFailure: function commentFailure(data) {
            // Show mew errors
            for (var field_name in data.errors) {
                if(field_name) {
                    var $field = $('#id_' + field_name);

                    // Twitter bootstrap style
                    $field.after('<span class="js-errors">' + data.errors[field_name] + '</span>');
                    $field.closest('.control-group').addClass('error');
                }
            }
        },

        // update options
        update: function flucom_options(key) {
            if ($.isPlainObject(key)) {
                this.options = $.extend(true,this.options,key);
            }
        }
    };

    /*
        ----------------------------
        Fluent Comments function
        ----------------------------

        Borrowed logic from the following...

        jQuery UI
        - https://github.com/jquery/jquery-ui/blob/master/ui/jquery.ui.widget.js

        jCarousel
        - https://github.com/jsor/jcarousel/blob/master/lib/jquery.jcarousel.js

        Masonry
        - https://github.com/desandro/masonry/blob/master/jquery.masonry.js

    */

    $.fn.fluentcomments = function (options) {
        var thisCall = typeof options;

        switch (thisCall) {

            // method
            case 'string':
                var args = Array.prototype.slice.call(arguments, 1);

                this.each(function () {
                    var instance = $.data(this, 'fluentcomments');

                    if (!instance) {
                        // not setup yet
                        // return $.error('Method ' + options + ' cannot be called until Fluent Comments is setup');
                        return false;
                    }

                    if (!$.isFunction(instance[options]) || options.charAt(0) === "_") {
                        // return $.error('No such method ' + options + ' for Fluent Comments');
                        return false;
                    }

                    // no errors!
                    instance[options].apply(instance, args);
                });

                break;

            // creation
            case 'object':
                this.each(function () {
                    var instance = $.data(this, 'fluentcomments');
                    if (instance) {
                        // update options of current instance
                        instance.update(options);

                    } else {

                        // initialize new instance
                        instance = new $.fluentcomments(options, this);

                        // don't attach if instantiation failed
                        if (!instance.failed) {
                            $.data(this, 'fluentcomments', instance);
                        }

                    }

                });

                break;
        }

        return this;
    };


})(window, document, jQuery);
