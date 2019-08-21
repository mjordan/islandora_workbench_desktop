/*jslint browser: true*/
/*jslint devel: true*/
/*jslint es6 */
/*global Headers, btoa*/

let spreadsheet = {};

// TODO: make URL and Authentication configurable.
let jsonApiPrefix = 'http://localhost:8000/jsonapi/';
let jsonApiHeaders = new Headers();
jsonApiHeaders.append('Authorization', 'Basic ' + btoa('admin' + ':' + 'islandora'));

let currentColumnDefinition = [];

let widgetMap = {
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
function updateDropdown(dropdown, termsPrefix, ...vocabs) {
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

// Populate content types dropdown
function listContentTypes() {
    fetch(jsonApiPrefix + 'node_type/node_type')
        .then( (response) => response.json() )
        .then(function (jsonapiResponse) {
            select = document.getElementById('content_type_select');
            jsonapiResponse.data.forEach(function (contentType) {
                select.options[select.options.length] = new Option(contentType.attributes.name, contentType.attributes.drupal_internal__type);
            });
        });
}

// Get the dropdowns ready.
let subjectsDropdown = [];
updateDropdown(subjectsDropdown, jsonApiPrefix + 'taxonomy_term/', 'subject', 'geo_location', 'person', 'family', 'corporate_body');

let accessDropdown = [];
updateDropdown(accessDropdown, jsonApiPrefix + 'taxonomy_term/', 'islandora_access');

// Configure and initialize the spreadsheet.
function loadData(data, columns = []) {
    // Reset the sheet.
    spreadsheetDiv = document.getElementById('spreadsheet');
    spreadsheetDiv.innerHTML = '';

    jexcelConfig = {
        search: true,
        updateTable: function (instance, cell, col, row, val, label, cellName) {
            // Odd row colours
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
        currentColumnDefinition = columns;
        // Column alignments, first (thumbnail) is centered, the rest are left.
        let colAlignments = Array(columns.length - 1).fill('left');
        colAlignments.unshift('center');
        jexcelConfig.colAlignments = colAlignments;
        jexcelConfig.columns = columns;
      }
      // Load the spreadsheet.
      spreadsheet = jexcel(spreadsheetDiv, jexcelConfig);
    } else if (typeof data === 'string') {
      // jexcelConfig.csv = data;
      loadViewsFields(data, jexcelConfig);
    } else {
      alert("Could not load the provided spreadsheet data: "+String(data));
      return false;
    }

}

// Load Views Fields
function loadViewsFields(restViewURI, jexcelConfig){
  let viewFields = fetch(jsonApiPrefix + 'view/view?filter[type][condition][path]=drupal_internal__id&filter[type][condition][value]=test', {
          headers: jsonApiHeaders
      })
      .then( (response) => response.json() )
      .then( function(jsonapiResponse){
          // console.log('View Fields', jsonapiResponse.data[0].attributes.display.default.fields);
          console.log('View Fields', jsonapiResponse.data[0].attributes.display.default.display_options);
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

    let data = fetch(restViewURI).then( function(response) {return response.json();} );

  Promise.all([viewFields, baseFieldOverrides, fieldSettings, data]).then(function (promises) {
      viewFields = promises[0];
      fieldSettings = { ...promises[1], ...promises[2] };
      viewData = promises[3];
      console.log('View Fields', viewFields);
      console.log('Field Settings', fieldSettings);
      console.log('View Data', viewData);

      columns = [];
      dropdownPromises = [];
      Object.keys(viewFields).forEach(function(field) {
        // console.log('Processing field '+field);
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
                        dropdownPromises.push(...updateDropdown(dropdownSource, jsonApiPrefix + targetType + '/', ...targetBundles));
                    }
                }
            } else if (field === 'nid') {
              column.type = 'hidden';
            }
            columns.push(column);
      });
      data = [];
      viewData.forEach(function (sourceRow) {
        row = [];
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
      console.log('Processed Columns', columns);
      console.log('Processed data', data);
      jexcelConfig.data = data;
      jexcelConfig.columns = columns;

      Promise.all(dropdownPromises).then(function(promises) {
        spreadsheet = jexcel(spreadsheetDiv, jexcelConfig);
      });

  });
}

// Load Spreadsheet based on content type
function loadContentType() {
  console.log('IN LOAD CONTENT TYPE');
    contentType = document.getElementById('content_type_select').value;

    let formFields = fetch(jsonApiPrefix + 'entity_form_display/entity_form_display?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
            headers: jsonApiHeaders
        })
        .then( (response) => response.json() )
        .then( (jsonapiResponse) => jsonapiResponse.data[0].attributes.content );

    let baseFieldOverrides = fetch(jsonApiPrefix + 'base_field_override/base_field_override?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
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
                    settings: field.attributes.settings
                };
            });
            return fields;
        });

    let fieldSettings = fetch(jsonApiPrefix + 'field_config/field_config?filter[type][condition][path]=bundle&filter[type][condition][value]=' + contentType, {
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
                    settings: field.attributes.settings
                };
            });
            return fields;
        });
    console.log('COLLECTING ALL THE PROMISES...')
    Promise.all([formFields, baseFieldOverrides, fieldSettings]).then(function (promises) {
        formFields = promises[0];
        fieldSettings = { ...promises[1], ...promises[2] };
        console.log('Form Fields', formFields);
        console.log('Field Settings', fieldSettings);

        columns = [];
        Object.keys(formFields).forEach(function(field) {
              // Defaults
              column = {
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
                      dropdownSource = [];
                      column.source = dropdownSource;
                      column.multiple = true;
                      // TODO: We don't yet support missing target_bundles (all bundles of type).
                      if (typeof fieldSettings[field].settings.handler_settings.target_bundles !== 'undefined') {
                          targetType = fieldSettings[field].settings.handler.replace(/^(default:)/, '');
                          targetBundles = Object.keys(fieldSettings[field].settings.handler_settings.target_bundles);
                          updateDropdown(dropdownSource, jsonApiPrefix + targetType + '/', ...targetBundles);
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

        data = [Array(columns.length).fill('')];
        console.log('Spreadsheet columns:', columns);
        loadData(data, columns);
    });
}
