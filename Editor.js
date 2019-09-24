const widgetMap = {
    // Only includes non-text items.
    boolean_checkbox: 'checkbox',
    entity_reference: 'autocomplete',
    number: 'numeric',
    options_buttons: 'dropdown',
    options_select: 'dropdown',
    typed_relation: 'dropdown', // Eventually a custom type or handler
    image: 'image'
};

// Function to load dropdown boxes with Taxonomy terms.
// TODO: sort the terms after an update.
// TODO: jsonapi pagination support
function updateDropdown (dropdown, termsPrefix, ...vocabs) {
    let promises = [];
    vocabs.forEach(function (vocab) {
        promises.push(fetch(termsPrefix + vocab)
            .then( (response) => response.json() )
            .then(function (jsonapiResponse) {
                jsonapiResponse.data.forEach(function (term) {
                    // Add the term if it is NOT already in the dropdown.
                    if (dropdown.findIndex( (existingTerm) => existingTerm.id === term.attributes.drupal_internal__tid) === -1) {
                        term = {
                            'name': term.attributes.name,
                            'id': term.attributes.drupal_internal__tid
                        };
                        dropdown.push(term);
                    }
                });
            }));
    });
    return promises;
}

class Editor {
  
  spreadsheet = {};

  currentColumnDefinition = [];

  constructor (spreadsheetDiv, jsonApiConfig = {host: 'http://localhost:8000', username: 'admin', password: 'islandora'}) {
    
    this.spreadsheetDiv = document.getElementById(spreadsheetDiv)
    
    this.jsonApiPrefix = jsonApiConfig.host + '/jsonapi/';
    this.jsonApiHeaders = new Headers();
    this.jsonApiHeaders.append('Authorization', 'Basic ' + btoa(jsonApiConfig.username + ':' + jsonApiConfig.password));
  }

  // Populate content types dropdown
  listContentTypes(content_types_select) {
      fetch(this.jsonApiPrefix + 'node_type/node_type')
          .then( (response) => response.json() )
          .then(function (jsonapiResponse) {
              jsonapiResponse.data.forEach(function (contentType) {
                  content_types_select.options[content_types_select.options.length] = new Option(contentType.attributes.name, contentType.attributes.drupal_internal__type);
              });
          });
  }
  
  // Load Spreadsheet based on content type
  loadContentType() {
      let contentType = document.getElementById('content_type_select').value;
      
      // Initiate field promises.
      let formFields = fetch(this.jsonApiPrefix + 'entity_form_display/entity_form_display?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
              headers: this.jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then( (jsonapiResponse) => jsonapiResponse.data[0].attributes.content );
      let baseFieldOverrides = fetch(this.jsonApiPrefix + 'base_field_override/base_field_override?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
              headers: this.jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then(function (jsonapiResponse) {
              let fields = {};
              jsonapiResponse.data.forEach(function (field) {
                  fields[field.attributes.field_name] = {
                      displayName: field.attributes.label,
                      required: field.attributes.required,
                      defaultValue: field.attributes.default_value,
                      settings: field.attributes.settings
                  };
              });
              return fields;
          });
      let fieldSettings = fetch(this.jsonApiPrefix + 'field_config/field_config?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
              headers: this.jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then(function (jsonapiResponse) {
              let fields = {};
              jsonapiResponse.data.forEach(function (field) {
                  fields[field.attributes.field_name] = {
                      displayName: field.attributes.label,
                      required: field.attributes.required,
                      defaultValue: field.attributes.default_value,
                      settings: field.attributes.settings
                  };
              });
              return fields;
          });
      
      // Gather the field promises.
      Promise.all([formFields, baseFieldOverrides, fieldSettings]).then(function (promises) {
          let formFields = promises[0];
          let fieldSettings = { ...promises[1], ...promises[2] };

          let columns = [];
          Object.keys(formFields).forEach(function(field) {
                // Defaults
                let column = {
                    id: field,
                    type: 'text',
                    title: field,
                    width: 200,
                    weight: formFields[field].weight
                };
                if (formFields[field].type in widgetMap) {
                    column.type = widgetMap[formFields[field].type];
                }
                if (formFields[field].settings.rows > 1) {
                    column.wordWrap = true;
                }
                // The resulting fields are probably too big...
                // if (formFields[field].settings.size > 1) {
                //   // One character is roughly 16 pixels wide at 12pt font (http://pxtoem.com/).
                //   column.width = formFields[field].settings.size * 16;
                // }
                if (field in fieldSettings) {
                    column.title = fieldSettings[field].displayName;

                    // Assume dropdowns and autocomplete are multiples until we
                    // are able to check field storage configs.
                    if (['autocomplete', 'dropdown'].includes(column.type)) {
                        let dropdownSource = [];
                        column.source = dropdownSource;
                        column.multiple = true;
                        // TODO: We don't yet support missing target_bundles (all bundles of type).
                        if (typeof fieldSettings[field].settings.handler_settings.target_bundles !== 'undefined') {
                            let targetType = fieldSettings[field].settings.handler.replace(/^(default:)/, '');
                            let targetBundles = Object.keys(fieldSettings[field].settings.handler_settings.target_bundles);
                            updateDropdown(dropdownSource, editor.jsonApiPrefix + targetType + '/', ...targetBundles);
                        }
                    }
                }
                columns.push(column);
          });

          columns.sort((a, b) => {
              return a.weight - b.weight;
          });
          columns.unshift({
              id: 'local_path_original',
              type: 'text',
              title: 'Original File Path',
              width: 120
          });
          columns.unshift({
              id: 'local_thumbnail',
              type: 'image',
              title: 'Thumbnail',
              width: 120
          });

          // Initialize spreadsheet with empty table data.
          editor.loadData([Array(columns.length).fill('')], columns);
      });
    }
  
  loadData (data, columns = []) {
    
    // Default configuration object
    let jexcelConfig = {
        search: true,
        updateTable: function (instance, cell, col, row, val, label, cellName) {
            // Odd row colours
            // @TODO: change to classes so coloring is set in CSS.
            if ( (row % 2) !== 0 ) {
                cell.style.backgroundColor = '#edf3ff';
            } else {
                cell.style.backgroundColor = '#ffffff';
            }
        },
        toolbar: [{
                type: 'i',
                content: 'undo',
                onclick: function () {
                    spreadsheet.undo();
                }
            },
            {
                type: 'i',
                content: 'redo',
                onclick: function () {
                    spreadsheet.redo();
                }
            },
            {
                type: 'i',
                content: 'save',
                onclick: function () {
                    spreadsheet.download();
                }
            },
            {
                type: 'i',
                content: 'format_align_left',
                k: 'text-align',
                v: 'left'
            },
            {
                type: 'i',
                content: 'format_align_center',
                k: 'text-align',
                v: 'center'
            },
            {
                type: 'i',
                content: 'format_align_right',
                k: 'text-align',
                v: 'right'
            }
        ],
        // Disallow column inserts until we can update currentColumnDefinition.
        allowInsertColumn: false,
        allowManualInsertColumn: false,
        // All columns need to be present for update.
        // We may be able to implement a column hide feature....
        allowDeleteColumn: false,
        minSpareRows: 1
    };
    
    // Set Source
    if (Array.isArray(data)) {
      jexcelConfig.data = data;
      if(Array.isArray(columns) && columns.length > 1) {
        this.currentColumnDefinition = columns;
        // Column alignments, first (thumbnail) is centered, the rest are left.
        let colAlignments = Array(columns.length - 1).fill('left');
        colAlignments.unshift('center');
        jexcelConfig.colAlignments = colAlignments;
        jexcelConfig.columns = columns;
      }
      // Load the spreadsheet.
      while(this.spreadsheetDiv.firstChild) {
        this.spreadsheetDiv.removeChild(this.spreadsheetDiv.firstChild);
      }
      this.spreadsheet = jexcel(this.spreadsheetDiv, jexcelConfig);

    } else if (typeof data === 'string') {

      if (!ping_islandora()){
        alert("Could not find Islandora w/ JSON:API to load "+data);
        return false;
      }
      
      let viewFields = fetch(jsonApiPrefix + 'view/view?filter[type][condition][path]=drupal_internal__id&filter[type][condition][value]=test', {
              headers: jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then( function(jsonapiResponse){
              return jsonapiResponse.data[0].attributes.display.default.display_options.fields;
          });

      let baseFieldOverrides = fetch(jsonApiPrefix + 'base_field_override/base_field_override', {
              headers: jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then(function (jsonapiResponse) {
              let fields = {};
              jsonapiResponse.data.forEach(function (field) {
                  fields[field.attributes.field_name] = {
                      displayName: field.attributes.label,
                      required: field.attributes.required,
                      defaultValue: field.attributes.default_value,
                      settings: field.attributes.settings,
                      fieldType: field.attributes.field_type
                  };
              });
              return fields;
          });

      let fieldSettings = fetch(jsonApiPrefix + 'field_config/field_config', {
              headers: jsonApiHeaders
          })
          .then( (response) => response.json() )
          .then(function (jsonapiResponse) {
              let fields = {};
              jsonapiResponse.data.forEach(function (field) {
                  fields[field.attributes.field_name] = {
                      displayName: field.attributes.label,
                      required: field.attributes.required,
                      defaultValue: field.attributes.default_value,
                      settings: field.attributes.settings,
                      type: field.attributes.field_type
                  };
              });
              return fields;
          });

        let data = fetch(data).then( function(response) {return response.json();} );

      Promise.all([viewFields, baseFieldOverrides, fieldSettings, data]).then(function (promises) {
          let viewFields = promises[0];
          let fieldSettings = { ...promises[1], ...promises[2] };
          let viewData = promises[3];

          let columns = [];
          let dropdownPromises = [];
          Object.keys(viewFields).forEach(function(field) {
                let column = {
                  id: field,
                  type: 'text',
                  title: field,
                  width: 200,
                  align: 'left'
                };
                // The resulting fields are probably too big...
                // if (formFields[field].settings.size > 1) {
                //   // One character is roughly 16 pixels wide at 12pt font (http://pxtoem.com/).
                //   column.width = formFields[field].settings.size * 16;
                // }
                if (field in fieldSettings) {
                    column.title = fieldSettings[field].displayName;
                    if (fieldSettings[field].type in widgetMap) {
                      column.type = widgetMap[fieldSettings[field].type];
                      if (['image','boolean'].includes(column.type)) {
                        column.align = 'center';
                      }
                    }
                    if (fieldSettings[field].type in ['text_long','string_long']) {
                      column.wordWrap = true;
                    }
                    // Assume dropdowns and autocomplete are multiples until we
                    // are able to check field storage configs.
                    if (['autocomplete', 'dropdown'].includes(column.type)) {
                        dropdownSource = [];
                        column.source = dropdownSource;
                        column.multiple = true; // @TODO: detect cardinality
                        // TODO: We don't yet support missing target_bundles (all bundles of type).
                        if (typeof fieldSettings[field].settings.handler_settings.target_bundles !== 'undefined') {
                            targetType = fieldSettings[field].settings.handler.replace(/^(default:)/, '');
                            targetBundles = Object.keys(fieldSettings[field].settings.handler_settings.target_bundles);
                            dropdownPromises.push(...this.updateDropdown(dropdownSource, jsonApiPrefix + targetType + '/', ...targetBundles));
                        }
                    }
                } else if (field === 'nid') {
                  column.type = 'hidden';
                }
                columns.push(column);
          });
          let data = [];
          viewData.forEach(function (sourceRow) {
            let row = [];
            columns.forEach(function(column){
              if(typeof column.id !== 'undefined' && typeof sourceRow[column.id] !== 'undefined') {
                if(['dropdown','autocomplete'].includes(column.type) ){
                  row.push(sourceRow[column.id].replace(',', ';').replace(' ', ''));
                } else {
                  row.push(sourceRow[column.id]);
                }
              } else {
                row.push('');
              }
            });
            data.push(row);
          });
          jexcelConfig.data = data;
          jexcelConfig.columns = columns;

          Promise.all(dropdownPromises).then(function(promises) {
            this.spreadsheetDiv.innerHTML = '';
            this.spreadsheetDiv = jexcel(spreadsheetDiv, jexcelConfig);
          });

      });
    } else {
      alert("Could not load the provided spreadsheet data: "+String(data));
      return false;
    }
  }
}