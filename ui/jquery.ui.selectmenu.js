/*!
 * jQuery UI Selectmenu @VERSION
 * http://jqueryui.com
 *
 * Copyright 2013 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/selectmenu
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 *	jquery.ui.position.js
 *	jquery.ui.menu.js
 */
(function( $, undefined ) {

$.widget( "ui.selectmenu", {
	version: "@VERSION",
	defaultElement: "<select>",
	options: {
		appendTo: null,
		icons: {
			button: "ui-icon-triangle-1-s"
		},
		position: {
			my: "left top",
			at: "left bottom",
			collision: "none"
		},

		// callbacks
		change: null,
		close: null,
		focus: null,
		open: null,
		select: null
	},

	_create: function() {
		var selectmenuId = this.element.uniqueId().attr( "id" );
		this.ids = {
			element: selectmenuId,
			button: selectmenuId + "-button",
			menu: selectmenuId + "-menu"
		};

		this._drawButton();
		this._drawMenu();

		if ( this.options.disabled ) {
			this.disable();
		}
	},

	_drawButton: function() {
		var tabindex = this.element.attr( "tabindex" );

		// Associate existing label with the new button
		this.label = $( "label[for='" + this.ids.element + "']" ).attr( "for", this.ids.button );
		this._on( this.label, {
			click: function( event ) {
				this.button.focus();
				event.preventDefault();
			}
		});

		// Hide original select element
		this.element.hide();

		// Create button
		this.button = $( "<span>", {
			"class": "ui-selectmenu-button ui-widget ui-state-default ui-corner-all",
			tabindex: tabindex || this.options.disabled ? -1 : 0,
			id: this.ids.button,
			width: this.element.outerWidth(),
			role: "combobox",
			"aria-expanded": "false",
			"aria-autocomplete": "list",
			"aria-owns": this.ids.menu,
			"aria-haspopup": "true"
		})
		.insertAfter( this.element );

		$( "<span>", {
			"class": "ui-icon " + this.options.icons.button
		}).prependTo( this.button );

		this.buttonText = $( "<span>", {
			"class": "ui-selectmenu-text"
		})
		.appendTo( this.button );
		this._setText( this.buttonText, this.element.find( "option:selected" ).text() );

		this._on( this.button, this._buttonEvents );
		this._hoverable( this.button );
		this._focusable( this.button );
	},

	_drawMenu: function() {
		var that = this;

		// Create menu
		this.menu = $( "<ul>", {
			"aria-hidden": "true",
			"aria-labelledby": this.ids.button,
			id: this.ids.menu
		});

		// Wrap menu
		this.menuWrap = $( "<div>", {
			"class": "ui-selectmenu-menu ui-front",
			outerWidth: this.button.outerWidth()
		})
		.append( this.menu )
		.appendTo( this._appendTo() );

		// Initialize menu widget
		this.menuInstance = this.menu.menu({
			role: "listbox",
			select: function( event, ui ) {
				var item = ui.item.data( "ui-selectmenu-item" );

				that._select( item, event );
			},
			focus: function( event, ui ) {
				var item = ui.item.data( "ui-selectmenu-item" );

				// Prevent inital focus from firing and checks if its a newly focused item
				if ( that.focusIndex != null && item.index !== that.focusIndex ) {
					that._trigger( "focus", event, { item: item } );
					if ( !that.isOpen ) {
						that._select( item, event );
					}
				}
				that.focusIndex = item.index;

				that.button.attr( "aria-activedescendant",
					that.menuItems.eq( item.index ).attr( "id" ) );
			}
		})
		.menu( "instance" );

		// Adjust menu styles to dropdown
		this.menu.addClass( "ui-corner-bottom" ).removeClass( "ui-corner-all" );

		// TODO: Can we make this cleaner?
		// If not, at least update the comment to say what we're removing
		// Unbind uneeded menu events
		this.menuInstance._off( this.menu, "mouseleave" );

		// Cancel the menu's collapseAll on document click
		this.menuInstance._closeOnDocumentClick = function() {
			return false;
		};
	},

	refresh: function() {
		this.menu.empty();

		var item,
			options = this.element.find( "option" );

		if ( !options.length ) {
			return;
		}

		this._readOptions( options );
		this._renderMenu( this.menu, this.items );

		this.menuInstance.refresh();
		this.menuItems = this.menu.find( "li" ).not( ".ui-selectmenu-optgroup" ).find( "a" );

		item = this._getSelectedItem();

		// Update the menu to have the correct item focused
		this.menuInstance.focus( null, item );
		this._setAria( item.data( "ui-selectmenu-item" ) );

		this._setText( this.buttonText, item.text() );

		// Set disabled state
		this._setOption( "disabled", this.element.prop( "disabled" ) );
	},

	open: function( event ) {
		if ( this.options.disabled ) {
			return;
		}

		// If this is the first time the menu is being opened, render the items
		if ( !this.menuItems ) {
			this.refresh();
		} else {
			// TODO: Why is this necessary?
			// Shouldn't the underlying menu always have accurate state?
			this.menu.find( ".ui-state-focus" ).removeClass( "ui-state-focus" );
			this.menuInstance.focus( null, this._getSelectedItem() );
		}

		this.isOpen = true;
		this._toggleAttr();
		this._position();

		this._on( this.document, this._documentClick );

		this._trigger( "open", event );
	},

	_position: function() {
		this.menuWrap.position( $.extend( { of: this.button }, this.options.position ) );
	},

	close: function( event ) {
		if ( !this.isOpen ) {
			return;
		}

		this.isOpen = false;
		this._toggleAttr();

		// Check if we have an item to select
		if ( this.menuItems ) {
			this.menuInstance.active = this._getSelectedItem();
		}

		this._off( this.document );

		this._trigger( "close", event );
	},

	widget: function() {
		return this.button;
	},

	menuWidget: function() {
		return this.menu;
	},

	_renderMenu: function( ul, items ) {
		var that = this,
			currentOptgroup = "";

		$.each( items, function( index, item ) {
			if ( item.optgroup !== currentOptgroup ) {
				$( "<li>", {
					"class": "ui-selectmenu-optgroup" +
						( item.element.parent( "optgroup" ).attr( "disabled" ) ?
							" ui-state-disabled" :
							"" ),
					text: item.optgroup
				})
				.appendTo( ul );
				currentOptgroup = item.optgroup;
			}
			that._renderItemData( ul, item );
		});
	},

	_renderItemData: function( ul, item ) {
		return this._renderItem( ul, item ).data( "ui-selectmenu-item", item );
	},

	_renderItem: function( ul, item ) {
		var li = $( "<li>" ),
			a = $( "<a>", { href: "#" });

		if ( item.disabled ) {
			li.addClass( "ui-state-disabled" );
		}
		this._setText( a, item.label );

		return li.append( a ).appendTo( ul );
	},

	_setText: function( element, value ) {
		if ( value ) {
			element.text( value );
		} else {
			element.html( "&#160;" );
		}
	},

	_move: function( direction, event ) {
		if ( direction === "first" || direction === "last" ) {
			// Set focus manually for first or last item
			this.menu.menu( "focus", event, this.menuItems[ direction ]() );
		} else {
			if ( direction === "previous" && this.menu.menu( "isFirstItem" ) ||
					direction === "next" && this.menu.menu( "isLastItem" ) ) {
				return;
			}

			// Move to and focus next or prev item
			this.menu.menu( direction, event );
		}
	},

	_getSelectedItem: function() {
		return this.menuItems.eq( this.element[ 0 ].selectedIndex ).parent( "li" );
	},

	_toggle: function( event ) {
		if ( this.isOpen ) {
			this.close( event );
		} else {
			this.open( event );
		}
	},

	_documentClick: {
		click: function( event ) {
			if ( this.isOpen && !$( event.target ).closest( "li.ui-state-disabled, li.ui-selectmenu-optgroup, #" + this.ids.button ).length ) {
				this.close( event );
			}
		}
	},

	_buttonEvents: {
		focusin: function() {
			// Delay rendering the menu items until the button receives focus
			if ( !this.menuItems ) {
				this.refresh();
			}
			this._off( this.button, "focusin" );
		},
		click: "_toggle",
		keydown: function( event ) {
			var preventDefault = true;
			switch ( event.keyCode ) {
				case $.ui.keyCode.TAB:
				case $.ui.keyCode.ESCAPE:
					this.close( event );
					preventDefault = false;
					break;
				case $.ui.keyCode.ENTER:
					if ( this.isOpen ) {
						this.menuInstance.select( event );
					}
					break;
				case $.ui.keyCode.UP:
					if ( event.altKey ) {
						this._toggle( event );
					} else {
						this._move( "previous", event );
					}
					break;
				case $.ui.keyCode.DOWN:
					if ( event.altKey ) {
						this._toggle( event );
					} else {
						this._move( "next", event );
					}
					break;
				case $.ui.keyCode.SPACE:
					if ( this.isOpen ) {
						this.menuInstance.select( event );
					} else {
						this._toggle( event );
					}
					break;
				case $.ui.keyCode.LEFT:
					this._move( "previous", event );
					break;
				case $.ui.keyCode.RIGHT:
					this._move( "next", event );
					break;
				case $.ui.keyCode.HOME:
				case $.ui.keyCode.PAGE_UP:
					this._move( "first", event );
					break;
				case $.ui.keyCode.END:
				case $.ui.keyCode.PAGE_DOWN:
					this._move( "last", event );
					break;
				default:
					this.menu.trigger( event );
					preventDefault = false;
			}

			if ( preventDefault ) {
				event.preventDefault();
			}
		}
	},

	_select: function( item, event ) {
		var oldIndex = this.element[ 0 ].selectedIndex;

		// Change native select element
		this.element[ 0 ].selectedIndex = item.index;
		this._setText( this.buttonText, item.label );
		this._setAria( item );
		this._trigger( "select", event, { item: item } );

		if ( item.index !== oldIndex ) {
			this._trigger( "change", event, { item: item } );
		}

		this.close( event );
	},

	_setAria: function( item ) {
		var link = this.menuItems.eq( item.index ),
			id = link.attr( "id" );

		this.button.attr({
			"aria-labelledby": id,
			"aria-activedescendant": id
		});
		this.menu.attr( "aria-activedescendant", id );
	},

	_setOption: function( key, value ) {
		if ( key === "icons" ) {
			this.button.find( "span.ui-icon" )
				.removeClass( this.options.icons.button )
				.addClass( value.button );
		}

		this._super( key, value );

		if ( key === "appendTo" ) {
			this.menuWrap.appendTo( this._appendTo() );
		}
		if ( key === "disabled" ) {
			this.menuInstance.option( "disabled", value );
			this.button
				.toggleClass( "ui-state-disabled", value )
				.attr( "aria-disabled", value );

			this.element.prop( "disabled", value );
			if ( value ) {
				this.button.attr( "tabindex", -1 );
				this.close();
			} else {
				this.button.attr( "tabindex", 0 );
			}
		}
	},

	_appendTo: function() {
		var element = this.options.appendTo;

		if ( element ) {
			element = element.jquery || element.nodeType ?
				$( element ) :
				this.document.find( element ).eq( 0 );
		}

		if ( !element ) {
			element = this.element.closest( ".ui-front" );
		}

		if ( !element.length ) {
			element = this.document[ 0 ].body;
		}

		return element;
	},

	_toggleAttr: function(){
		this.button
			.toggleClass( "ui-corner-top", this.isOpen )
			.toggleClass( "ui-corner-all", !this.isOpen );
		this.menuWrap.toggleClass( "ui-selectmenu-open", this.isOpen );
		this.menu.attr( "aria-hidden", !this.isOpen );
		this.button.attr( "aria-expanded", this.isOpen );
	},

	_getCreateOptions: function() {
		return { disabled: this.element.prop( "disabled" ) };
	},

	_readOptions: function( options ) {
		var data = [];
		options.each( function( index, item ) {
			var option = $( item ),
				optgroup = option.parent( "optgroup" );
			data.push({
				element: option,
				index: index,
				value: option.attr( "value" ),
				label: option.text(),
				optgroup: optgroup.attr( "label" ) || "",
				disabled: optgroup.attr( "disabled" ) || option.attr( "disabled" )
			});
		});
		this.items = data;
	},

	_destroy: function() {
		this.menuWrap.remove();
		this.button.remove();
		this.element.show();
		this.element.removeUniqueId();
		this.label.attr( "for", this.ids.element );
	}
});

}( jQuery ));
