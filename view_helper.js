// ---- these are helper functions that let you more easily create useful elements. ----
// ---- Most functions have a required "id_prefix" parameter: you need to specify unique ids that will be used in the HTML, 
// ---- so that we can tell from the logs what was actually clicked on.


// --- helper functions for connecting things with events ---

// define an observer which will call the passed on_attr_change function when the watched_attribute of watched_elem_selector 
// (more precisely, the first element that matches watched_elem_selector; will not work as intended if the selector selects more than one thing.)
function define_attribute_observer(watched_elem_selector, watched_attribute, on_attr_change = function(new_value){}){
    // set up the observer:
    let attribute_observer = new MutationObserver(function(mutationsList, observer){
        for(let mutation of mutationsList) {
            if(mutation.type === 'attributes') {
                if(mutation.attributeName === watched_attribute) {
                    // call the function for processing of the attribute change:
                    on_attr_change(watched_elem_selector.attr(watched_attribute))
                }
            }
        }
    })
    let watched_element = watched_elem_selector.get(0) // get the DOM element associated with the selector
    attribute_observer.observe(watched_element, {attributes: true})

}


// --- Helper functions to create transient elements and data structures.
// --- These elements will be created and destroyed as needed (often when the data being displayed changes).

// Make an element for a user - this element would usually go into a selectable list of users. 
// The element automatically creates an icon which varies based on whether it's a singular user or a group, 
// and also adds any attributes you pass along
// If it's a group, adds expandable functionality to show member users
function make_user_elem(id_prefix, uname, user_attributes=null) {
    let user_or_group = all_users[uname];
    let is_group = !is_user(user_or_group);
    
    // For groups, add chevron icon and make it expandable
    let chevron_html = '';
    if(is_group) {
        chevron_html = `<span id="${id_prefix}_${uname}_chevron" class="oi oi-chevron-right group-chevron" style="font-size:0.8em;margin-right:4px;cursor:pointer;"></span>`;
    }
    
    user_elem = $(`<div class="ui-widget-content user-or-group-item ${is_group ? 'group-item' : 'user-item'}" id="${id_prefix}_${uname}" name="${uname}">
        ${chevron_html}
        <span id="${id_prefix}_${uname}_icon" class="oi ${is_group ? 'oi-people' : 'oi-person'}"/> 
        <span id="${id_prefix}_${uname}_text" style="${is_group ? 'cursor:pointer;font-weight:500;' : ''}">${uname}</span>
    </div>`)

    if (user_attributes) {
        // if we need to add the user's attributes: go through the properties for that user and add each as an attribute to user_elem.
        for(uprop in user_attributes) {
            user_elem.attr(uprop, user_attributes[uprop])
        }
    }
    
    // If it's a group, add click handler for expanding/collapsing
    if(is_group && user_or_group.users) {
        console.log(`Setting up click handler for group: ${uname}, members:`, user_or_group.users);
        
        // Mark as expandable group for styling
        user_elem.attr('data-is-group', 'true');
        user_elem.css('cursor', 'pointer');
        
        // Add mousedown handler (fires before jQuery UI selectable) for expanding/collapsing
        // Use mousedown instead of click because jQuery UI selectable intercepts click events
        user_elem.on('mousedown', function(e) {
            // Only handle left mouse button
            if(e.which !== 1) return;
            
            console.log(`Group mousedown: ${uname}`);
            
            // Toggle member visibility using data attribute
            let members = $(`[data-group-parent="${id_prefix}_${uname}"]`);
            console.log(`Found ${members.length} member elements to toggle`);
            
            if(members.length > 0) {
                members.toggle();
                
                // Toggle chevron
                let chevron = $(`#${id_prefix}_${uname}_chevron`);
                if(chevron.hasClass('oi-chevron-right')) {
                    chevron.removeClass('oi-chevron-right').addClass('oi-chevron-bottom');
                } else {
                    chevron.removeClass('oi-chevron-bottom').addClass('oi-chevron-right');
                }
            }
            
            // Let the event propagate so jQuery UI selectable can also select this group
            // This allows editing group-level permissions
        });
    }

    return user_elem
}


// make a list of users, suitable for inserting into a select list, given a map of user name to some arbitrary info.
// optionally, adds all the properties listed for a given user as attributes for that user's element.
function make_user_list(id_prefix, usermap, add_attributes = false) {
    let u_elements = []
    for(uname in usermap){
        // make user element; if add_attributes is true, pass along usermap[uname] for attribute creation.
        user_elem = make_user_elem(id_prefix, uname, add_attributes ? usermap[uname] : null )
        u_elements.push(user_elem)
        
        // If it's a group, also create member elements
        let user_or_group = all_users[uname];
        if(!is_user(user_or_group) && user_or_group.users) {
            console.log(`Creating member elements for group: ${uname}, members:`, user_or_group.users);
            for(let member_name of user_or_group.users) {
                console.log(`  Creating member element for: ${member_name} with data-group-parent="${id_prefix}_${uname}"`);
                let member_elem = $(`<div class="ui-widget-content group-member-item" id="${id_prefix}_${uname}_member_${member_name}" name="${member_name}" data-group-parent="${id_prefix}_${uname}" data-is-member="true" style="display:none;padding-left:30px;background-color:#f9f9f9;font-size:0.9em;cursor:pointer;">
                    <span class="oi oi-person" style="font-size:0.8em;color:#666;margin-right:4px;"/> 
                    <span>${member_name}</span>
                    <span style="color:#999;font-size:0.85em;margin-left:6px;">(from ${uname})</span>
                </div>`)
                
                // Make member selectable - when clicked, create a standalone entry for individual permission editing
                member_elem.click(function(e) {
                    e.stopPropagation();
                    
                    // Get the actual member username (not the group name)
                    let actual_member_name = $(this).attr('name');
                    let parent_group_id = $(this).attr('data-group-parent');
                    
                    console.log(`Member clicked: ${actual_member_name}`);
                    
                    // Find the parent selectable list
                    let user_list = $(this).parent();
                    
                    // Check if this member already exists as a standalone entry (not a group member)
                    let standalone_elem = user_list.find(`#${id_prefix}_${actual_member_name}`).not('[data-is-member="true"]');
                    
                    if(standalone_elem.length > 0) {
                        // Standalone entry exists, select it instead
                        console.log(`Standalone entry found for ${actual_member_name}, selecting it`);
                        user_list.children().removeClass('ui-selected');
                        standalone_elem.addClass('ui-selected');
                        user_list.attr('selected_item', actual_member_name);
                        
                        let selection_handler = user_list.data('selection_handler');
                        if(selection_handler) {
                            selection_handler(actual_member_name, e, {selected: standalone_elem[0]});
                        }
                    } else {
                        // No standalone entry exists, we need to create one
                        console.log(`No standalone entry for ${actual_member_name}, creating one`);
                        
                        // Get the current filepath from the user list's parent dialog
                        let current_filepath = user_list.closest('[filepath]').attr('filepath');
                        
                        if(current_filepath && current_filepath in path_to_file) {
                            // Create a new standalone user element
                            let new_user_elem = make_user_elem(id_prefix, actual_member_name, {filepath: current_filepath});
                            
                            // Find where to insert it (after the parent group's last member)
                            let parent_group_elem = user_list.find(`#${parent_group_id}`);
                            let insert_after = parent_group_elem;
                            
                            // Find the last member of this group
                            let group_members = user_list.find(`[data-group-parent="${parent_group_id}"]`);
                            if(group_members.length > 0) {
                                insert_after = group_members.last();
                            }
                            
                            // Insert the new element
                            new_user_elem.insertAfter(insert_after);
                            
                            // Make the new element selectable by jQuery UI
                            new_user_elem.addClass('ui-selectee');
                            
                            // Select the new element
                            user_list.children().removeClass('ui-selected');
                            new_user_elem.addClass('ui-selected');
                            user_list.attr('selected_item', actual_member_name);
                            
                            // Trigger the selection handler to show permissions for this user
                            let selection_handler = user_list.data('selection_handler');
                            if(selection_handler) {
                                selection_handler(actual_member_name, e, {selected: new_user_elem[0]});
                            }
                        }
                    }
                });
                
                // Copy attributes from parent if needed
                if(add_attributes && usermap[uname]) {
                    for(uprop in usermap[uname]) {
                        member_elem.attr(uprop, usermap[uname][uprop])
                    }
                }
                
                u_elements.push(member_elem)
            }
        }
    }
    return u_elements
}


// --- helper functions to define various semi-permanent elements.
// --- Only call these once for each new dialog/selection/item etc. you are defining! (NOT each time you want to open/close/hide a dialog)


// Define a new type of dialog. 
//
// This is essentially a wrapper for a jquery-ui dialog (https://jqueryui.com/dialog/) with some defaults.
// So you can pass in any options available for the dialog widget, and then use the returned value as you would a dialog.
//
// Store the return value in a variable, say new_dialog; then open/close the dialog as needed using:
// new_dialog.dialog('open')
// new_dialog.dialog('close')
//
// - id_orefux is any unique id prefix, as usual
// - title is a string which will go in the title area of the dialog box
// - options is a set of jquery-ui options
// - returns the dialog jquery object
function define_new_dialog(id_prefix, title='', options = {}){
    let default_options = {
        appendTo: "#html-loc",
        autoOpen: false,
        modal: true,
        position: { my: "top", at: "top", of: $('#html-loc') },
    }
    
    // add default options - do not override ones that are already specified.
    for(let d_o in default_options){
        if(!(d_o in options)){
            options[d_o] = default_options[d_o];
        } 
    }

    let dialog = $(`<div id="${id_prefix}" title="${title}"></div>`).dialog(options)

    return dialog
}

// Define a generic list which allows you to select one of the items, and propagates that item's 'name' attribute to its own 'selected_item' attribute.
// Note: each selectable item in the list is expted to have a 'name' attribute.
// creates and returns a custom jquery-ui selectable (https://jqueryui.com/selectable/).
// Optionally, provide a custom callback function for what to update when a new selection is made. 
// This callback function will be called with 3 arguments: 
//    the string from the 'name' attribute of the selected item (probably the only thing you need);
//    the selection event;
//    and the actual HTML element of the selected item
function define_single_select_list(id_prefix, on_selection_change = function(selected_item_name, e, ui){}) {
    let select_list = $(`<div id="${id_prefix}" style="overflow-y:scroll"></div>`).selectable({
        selected: function(e, ui) { 

            // Unselect any previously selected (normally, selectable allows multiple selections)
            $(ui.selected).addClass("ui-selected").siblings().removeClass("ui-selected");
            
            // store info about what item was selected:
            selected_item_name = $(ui.selected).attr('name')
            $( this ).attr('selected_item', selected_item_name)

            on_selection_change(selected_item_name, e, ui)

            emitter.dispatchEvent(new CustomEvent('userEvent', { 
                detail: new ClickEntry(
                    ActionEnum.CLICK, 
                    (e.clientX + window.pageXOffset), 
                    (e.clientY + window.pageYOffset), 
                    `${$( this ).attr('id')} selected: ${selected_item_name}`,
                    new Date().getTime()) 
            }))
        }
    })
    
    // Store the selection handler so group members can use it
    select_list.data('selection_handler', on_selection_change)

    select_list.unselect = function() {
        select_list.find('.ui-selectee').removeClass('ui-selected')
        on_selection_change('', null, null)
    }

    return select_list
}

 
// define an element which will display effective permissions for a given file and user
// It expects the file path to be stored in its *filepath* attribute, 
// and the user name to be stored in its *username* attribute 
// when either changes, the panel attempts to recalculate the effective permissions.
// - id_prefix is a (required) unique string which will be prepended to all the generated elements.
// - add_info_col is a boolean for whether you want a third column with "info" buttons (which do nothing by default)
// - returns the jquery object for the effective permissions panel, ready to be attached/appended anywhere you want it.
function define_new_effective_permissions(id_prefix, add_info_col = false, which_permissions = null){
    // Set up the table:
    let effective_container = $(`<div id="${id_prefix}" class="ui-widget-content" style="overflow-y:scroll"></div>`)
    
    // If no subset of permissions is passed in, use all of them.
    if(which_permissions === null) {
        which_permissions = Object.values(permissions)
    }
    // add a row for each permission:
    for(let p of which_permissions) {
        let p_id = p.replace(/[ \/]/g, '_') //get jquery-readable id
        let row = $(`
        <tr id="${id_prefix}_row_${p_id}" permission_name="${p}" permission_id="${p_id}">
            <td id="${id_prefix}_checkcell_${p_id}" class="effectivecheckcell" width="16px"></td>
            <td id="${id_prefix}_name_${p_id}" class="effective_perm_name">${p}</td>
        </tr>
        `)
        // If we want to add an additional info column (which does nothing by default)
        if(add_info_col) {
            row.append(`
            <td id="${id_prefix}_${p_id}_info_cell" width="32px" style="text-align:right">
                <span id="${id_prefix}_${p_id}_info_icon" class="fa fa-info-circle perm_info" permission_name="${p}" setting_container_id="${id_prefix}"/>
            </td>`)
        }
        effective_container.append(row)
    }

    // Define how to update contents on attribute change:
    let update_effective_contents = function(){
        // get current settings:
        let username = effective_container.attr('username')
        let filepath = effective_container.attr('filepath')
        // if both properties are set correctly:
        if( username && username.length > 0 && (username in all_users) &&
            filepath && filepath.length > 0 && (filepath in path_to_file)) {
            //clear out the checkboxes:
            effective_container.find(`.effectivecheckcell`).empty()

            // Set checkboxes correctly for given file and user:
            for(let p of which_permissions) {
                let p_id = p.replace(/[ \/]/g, '_') //get jquery-readable id
                // if the actual model would allow an action with permission
                if( allow_user_action(path_to_file[filepath], all_users[username], p)) {
                    // This action is allowed. Find the checkbox cell and put a checkbox there.
                    let this_checkcell = effective_container.find(`#${id_prefix}_checkcell_${p_id}`)
                    this_checkcell.append(`<span id="${id_prefix}_checkbox_${p_id}" class="oi oi-check"/>`)
                }
            }
        }
    }

    // call update_effective_contents when either username or filepath changes:
    define_attribute_observer(effective_container, 'username', update_effective_contents)
    define_attribute_observer(effective_container, 'filepath', update_effective_contents)
    
    return effective_container
}


// define an element which will display *grouped* permissions for a given file and user, and allow for changing them by checking/unchecking the checkboxes.
function define_grouped_permission_checkboxes(id_prefix, which_groups = null) {
    // Set up table and header:
    let group_table = $(`
    <table id="${id_prefix}" class="ui-widget-content" width="100%">
        <tr id="${id_prefix}_header">
            <th id="${id_prefix}_header_p" width="99%">Permissions for <span id="${id_prefix}_header_username"></span>
            </th>
            <th id="${id_prefix}_header_allow">Allow</th>
            <th id="${id_prefix}_header_deny" title="Deny always overrides Allow">Deny</th>
        </tr>
    </table>
    `)

    if(which_groups === null) {
        which_groups = perm_groupnames
    }
    // For each permissions group, create a row:
    for(let g of which_groups){
        // Full_control and Special_permissions should not be expandable
        let is_expandable = (g !== 'Special_permissions' && g !== 'Full_control' && g in permission_groups)
        
        // Create the main group row with expand/collapse icon
        let group_label = g;
        let group_title = '';
        
        // Rename Read_Execute to just "Execute" for clarity
        if(g === 'Read_Execute') {
            group_label = 'Execute';
            group_title = 'title="Grants Read + Execute permissions"';
        }
        
        let row = $(`<tr id="${id_prefix}_row_${g}" class="group_row">
            <td id="${id_prefix}_${g}_name" style="cursor:${is_expandable ? 'pointer' : 'default'};" ${group_title}>
                ${is_expandable ? '<span id="' + id_prefix + '_' + g + '_expand_icon" class="oi oi-chevron-right" style="font-size:0.9em;margin-right:4px;"></span>' : ''}
                ${group_label}
            </td>
        </tr>`)
        for(let ace_type of ['allow', 'deny']) {
            row.append(`<td id="${id_prefix}_${g}_${ace_type}_cell">
                <input type="checkbox" id="${id_prefix}_${g}_${ace_type}_checkbox" ptype="${ace_type}" class="groupcheckbox" group="${g}" ></input>
            </td>`)
        }
        group_table.append(row)
        
        // Add sub-rows for individual permissions in this group (if expandable and not Full_control)
        if(is_expandable) {
            let perms_to_show = permission_groups[g];
            
            // For Read_Execute, only show the unique EXECUTE permission (avoid duplicating Read permissions)
            if(g === 'Read_Execute') {
                perms_to_show = [permissions.EXECUTE]; // Only show "traverse folder/execute file"
            }
            
            for(let perm of perms_to_show) {
                let p_id = perm.replace(/[ \/]/g, '_')
                let sub_row = $(`<tr id="${id_prefix}_row_${g}_${p_id}" class="sub_perm_row" group="${g}" style="display:none;background-color:#f5f5f5;">
                    <td id="${id_prefix}_${g}_${p_id}_name" style="padding-left:30px;font-size:0.9em;">${perm}</td>
                </tr>`)
                for(let ace_type of ['allow', 'deny']) {
                    sub_row.append(`<td id="${id_prefix}_${g}_${p_id}_${ace_type}_cell">
                        <input type="checkbox" id="${id_prefix}_${g}_${p_id}_${ace_type}_checkbox" ptype="${ace_type}" class="perm_checkbox" permission="${perm}" ></input>
                    </td>`)
                }
                group_table.append(sub_row)
            }
        }
    }  

    // Add click handler for expand/collapse functionality
    group_table.find('.group_row').each(function() {
        let row = $(this)
        let group_name = row.attr('id').replace(`${id_prefix}_row_`, '')
        let icon = row.find('.oi')
        
        // Only add click handler if there's an icon (i.e., it's expandable)
        if(icon.length > 0) {
            row.find('td:first').click(function() {
                // Toggle sub-rows visibility
                let sub_rows = group_table.find(`.sub_perm_row[group="${group_name}"]`)
                sub_rows.toggle()
                
                // Toggle icon between chevron-right (collapsed) and chevron-bottom (expanded)
                if(icon.hasClass('oi-chevron-right')) {
                    icon.removeClass('oi-chevron-right').addClass('oi-chevron-bottom')
                } else {
                    icon.removeClass('oi-chevron-bottom').addClass('oi-chevron-right')
                }
            })
        }
    })

    group_table.find('.groupcheckbox').prop('disabled', true)// disable all checkboxes to start
    group_table.find('.perm_checkbox').prop('disabled', true)// disable all specific permission checkboxes to start

    // Update checkboxes when either user or file changes:
    let update_group_checkboxes = function(){

        // get current settings:
        let username = group_table.attr('username')
        let filepath = group_table.attr('filepath')
        // if both properties are set correctly:
        if( username && username.length > 0 && (username in all_users) &&
            filepath && filepath.length > 0 && (filepath in path_to_file)) {
                    
            // clear previous checkbox state:
            group_table.find('.groupcheckbox').prop('disabled', false)
            group_table.find('.groupcheckbox').prop('checked', false)
            group_table.find('.groupcheckbox[group="Special_permissions"]').prop('disabled', true) // special_permissions is always disabled
            
            // clear specific permission checkbox states:
            group_table.find('.perm_checkbox').prop('disabled', false)
            group_table.find('.perm_checkbox').prop('checked', false)

            // change name on table:
            $(`#${id_prefix}_header_username`).text(username)

            // get new grouped permissions:
            let grouped_perms = get_grouped_permissions(path_to_file[filepath], username)
            
            // Get individual permissions to check for partial states
            let all_perms = get_total_permissions(path_to_file[filepath], username)

            for( ace_type in grouped_perms) { // 'allow' and 'deny'
                for(allowed_group in grouped_perms[ace_type]) {
                    let checkbox = group_table.find(`#${id_prefix}_${allowed_group}_${ace_type}_checkbox`)
                    checkbox.prop('checked', true)
                    checkbox.prop('indeterminate', false) // Reset indeterminate state
                    // TEMPORARILY DISABLED - testing group inheritance warning
                    // if(grouped_perms[ace_type][allowed_group].inherited) {
                    //     // can't uncheck inherited permissions.
                    //     checkbox.prop('disabled', true)
                    // }
                }
            }
            
            // Special handling for Execute (Read_Execute): only check if EXECUTE permission is present
            // (not the full Read_Execute group)
            for(let ace_type of ['allow', 'deny']) {
                let execute_checkbox = group_table.find(`#${id_prefix}_Read_Execute_${ace_type}_checkbox`);
                
                // Check if EXECUTE permission is present
                if(all_perms[ace_type] && all_perms[ace_type][permissions.EXECUTE]) {
                    execute_checkbox.prop('checked', true);
                    execute_checkbox.prop('indeterminate', false);
                    // TEMPORARILY DISABLED - testing group inheritance warning
                    // if(all_perms[ace_type][permissions.EXECUTE].inherited) {
                    //     execute_checkbox.prop('disabled', true);
                    // }
                } else {
                    execute_checkbox.prop('checked', false);
                    execute_checkbox.prop('indeterminate', false);
                }
            }
            
            // Check for partial/indeterminate states (when some but not all permissions in a group are checked)
            // Skip Read_Execute since we handle it specially (only checks EXECUTE permission)
            for(let g of which_groups) {
                if(g !== 'Special_permissions' && g !== 'Full_control' && g !== 'Read_Execute' && g in permission_groups) {
                    for(let ace_type of ['allow', 'deny']) {
                        let group_perms = permission_groups[g]
                        let checked_count = 0
                        let total_count = group_perms.length
                        
                        // Count how many permissions in this group are checked
                        for(let perm of group_perms) {
                            if(all_perms[ace_type] && all_perms[ace_type][perm]) {
                                checked_count++
                            }
                        }
                        
                        let checkbox = group_table.find(`#${id_prefix}_${g}_${ace_type}_checkbox`)
                        
                        // If some (but not all) permissions are checked, show indeterminate state
                        if(checked_count > 0 && checked_count < total_count) {
                            checkbox.prop('checked', false)
                            checkbox.prop('indeterminate', true)
                        } else if(checked_count === 0) {
                            checkbox.prop('checked', false)
                            checkbox.prop('indeterminate', false)
                        }
                        // If all are checked, it's already set above in grouped_perms loop
                    }
                }
            }
            
            // Update individual permission checkboxes
            // (we already have all_perms from above, no need to call get_total_permissions again)
            for( ace_type in all_perms) { // 'allow' and 'deny'
                for(allowed_perm in all_perms[ace_type]) {
                    let p_id = allowed_perm.replace(/[ \/]/g, '_') 
                    let checkbox = group_table.find(`.perm_checkbox[permission="${allowed_perm}"]`).filter(function() {
                        return $(this).attr('ptype') === ace_type
                    })
                    checkbox.prop('checked', true)
                    // TEMPORARILY DISABLED - testing group inheritance warning
                    // if(all_perms[ace_type][allowed_perm].inherited) {
                    //     // can't uncheck inherited permissions.
                    //     checkbox.prop('disabled', true)
                    // }
                }
            }
        }
        else {
            // can't get permissions for this username/filepath - reset everything into a blank state
            group_table.find('.groupcheckbox').prop('disabled', true)
            group_table.find('.groupcheckbox').prop('checked', false)
            group_table.find('.perm_checkbox').prop('disabled', true)
            group_table.find('.perm_checkbox').prop('checked', false)
            $(`#${id_prefix}_header_username`).text('')
        }

    }
    define_attribute_observer(group_table, 'username', update_group_checkboxes)
    define_attribute_observer(group_table, 'filepath', update_group_checkboxes)

    //Update permissions when group checkbox is clicked:
    group_table.find('.groupcheckbox').change(function(){
        console.log('=== GROUP CHECKBOX CHANGED ===');
        
        let group = $(this).attr('group');
        let ptype = $(this).attr('ptype');
        let is_checked = $(this).prop('checked');
        let filepath = group_table.attr('filepath');
        let username = group_table.attr('username');
        
        console.log(`Group: ${group}, Type: ${ptype}, Checked: ${is_checked}, User: ${username}`);
        console.log(`Condition check: ptype==='allow'? ${ptype === 'allow'}, !is_checked? ${!is_checked}`);
        
        // Check if trying to UNCHECK an ALLOW or DENY permission that comes from a group
        if(!is_checked) {
            console.log(`Checking if group ${group} (${ptype}) for user ${username} comes from group inheritance`);
            
            // Check all permissions in this group to see if any come from group membership
            let perms_to_check = (group === 'Read_Execute') ? [permissions.EXECUTE] : permission_groups[group];
            let from_group = null;
            let is_allow_ace = (ptype === 'allow');
            
            for(let perm of perms_to_check) {
                from_group = check_permission_from_group(path_to_file[filepath], username, perm, is_allow_ace);
                console.log(`  Permission ${perm} (${ptype}) from group: ${from_group}`);
                if(from_group) break; // Found one from a group
            }
            
            if(from_group) {
                console.log(`Permission is inherited from group ${from_group}, showing warning dialog`);
                
                // Permission comes from a group - show warning and prevent unchecking
                $(this).prop('checked', true); // Revert the checkbox
                
                // Show warning dialog
                $('#group_inherited_username').text(username);
                $('#group_inherited_username2').text(username);
                $('#group_inherited_groupname').text(from_group);
                $('#group_inherited_groupname2').text(from_group);
                
                // Check if dialog exists
                if($('#group_inherited_warning_dialog').length > 0) {
                    console.log('Dialog element found, opening...');
                    $('#group_inherited_warning_dialog').dialog('open');
                } else {
                    console.error('Dialog element not found!');
                }
                
                return; // Don't proceed with toggling
            } else {
                console.log('No group inheritance found, allowing removal');
            }
        }
        
        // If Deny is being checked, uncheck the corresponding Allow (since Deny overrides Allow)
        if(ptype === 'deny' && is_checked) {
            let allow_checkbox = group_table.find(`#${id_prefix}_${group}_allow_checkbox`);
            if(allow_checkbox.prop('checked')) {
                // Uncheck the allow first
                allow_checkbox.prop('checked', false);
                
                // For Execute (Read_Execute), only toggle EXECUTE permission
                if(group === 'Read_Execute') {
                    toggle_permission(filepath, username, permissions.EXECUTE, 'allow', false);
                } else {
                    toggle_permission_group(filepath, username, group, 'allow', false);
                }
            }
        }
        
        // For Execute (Read_Execute), only toggle the EXECUTE permission, not the whole Read_Execute group
        if(group === 'Read_Execute') {
            toggle_permission(filepath, username, permissions.EXECUTE, ptype, is_checked);
        } else {
            toggle_permission_group(filepath, username, group, ptype, is_checked);
        }
        
        update_group_checkboxes()// reload checkboxes
    })
    
    //Update permissions when individual permission checkbox is clicked:
    group_table.find('.perm_checkbox').change(function(){
        let permission = $(this).attr('permission');
        let ptype = $(this).attr('ptype');
        let is_checked = $(this).prop('checked');
        let filepath = group_table.attr('filepath');
        let username = group_table.attr('username');
        
        // Check if trying to UNCHECK an ALLOW or DENY permission that comes from a group
        if(!is_checked) {
            console.log(`Checking if permission ${permission} (${ptype}) for user ${username} comes from group inheritance`);
            
            let is_allow_ace = (ptype === 'allow');
            let from_group = check_permission_from_group(path_to_file[filepath], username, permission, is_allow_ace);
            console.log(`  Permission ${permission} (${ptype}) from group: ${from_group}`);
            
            if(from_group) {
                console.log(`Permission is inherited from group ${from_group}, showing warning dialog`);
                
                // Permission comes from a group - show warning and prevent unchecking
                $(this).prop('checked', true); // Revert the checkbox
                
                // Show warning dialog
                $('#group_inherited_username').text(username);
                $('#group_inherited_username2').text(username);
                $('#group_inherited_groupname').text(from_group);
                $('#group_inherited_groupname2').text(from_group);
                
                // Check if dialog exists
                if($('#group_inherited_warning_dialog').length > 0) {
                    console.log('Dialog element found, opening...');
                    $('#group_inherited_warning_dialog').dialog('open');
                } else {
                    console.error('Dialog element not found!');
                }
                
                return; // Don't proceed with toggling
            } else {
                console.log('No group inheritance found, allowing removal');
            }
        }
        
        // If Deny is being checked, uncheck the corresponding Allow (since Deny overrides Allow)
        if(ptype === 'deny' && is_checked) {
            // Find all checkboxes for this permission with allow type
            let allow_checkboxes = group_table.find(`.perm_checkbox[permission="${permission}"]`).filter(function() {
                return $(this).attr('ptype') === 'allow';
            });
            
            allow_checkboxes.each(function() {
                if($(this).prop('checked')) {
                    $(this).prop('checked', false);
                    toggle_permission(filepath, username, permission, 'allow', false);
                }
            });
        }
        
        toggle_permission(filepath, username, permission, ptype, is_checked)
        update_group_checkboxes()// reload checkboxes
    })

    return group_table
}

// define an element which will display *individual* permissions for a given file and user, and allow for changing them by checking/unchecking the checkboxes.
function define_permission_checkboxes(id_prefix, which_permissions = null){
    // Set up table and header:
    let perm_table = $(`
    <table id="${id_prefix}" class="ui-widget-content" width="100%">
        <tr id="${id_prefix}_header">
            <th id="${id_prefix}_header_p" width="99%">Permissions for <span id="${id_prefix}_header_username"></span>
            </th>
            <th id="${id_prefix}_header_allow">Allow</th>
            <th id="${id_prefix}_header_deny">Deny</th>
        </tr>
    </table>
    `)

    // If no subset of permissions is passed in, use all of them.
    if(which_permissions === null) {
        which_permissions = Object.values(permissions)
    }
    // For each type of permission, create a row:
    for(let p of which_permissions){
        let p_id = p.replace(/[ \/]/g, '_') 
        let row = $(`<tr id="${id_prefix}_row_${p_id}">
            <td id="${id_prefix}_${p_id}_name">${p}</td>
        </tr>`)
        // Add allow and deny checkboxes:
        for(let ace_type of ['allow', 'deny']) {
            row.append(`<td id="${id_prefix}_${p_id}_${ace_type}_cell">
                <input type="checkbox" id="${id_prefix}_${p_id}_${ace_type}_checkbox" ptype="${ace_type}" class="perm_checkbox" permission="${p}" ></input>
            </td>`)
        }
        perm_table.append(row)
    }

    perm_table.find('.perm_checkbox').prop('disabled', true)// disable all checkboxes to start

    let update_perm_table = function(){

        // get current settings:
        let username = perm_table.attr('username')
        let filepath = perm_table.attr('filepath')
        // if both properties are set correctly:
        if( username && username.length > 0 && (username in all_users) &&
            filepath && filepath.length > 0 && (filepath in path_to_file)) {
            
            // clear previous checkbox state:
            perm_table.find('.perm_checkbox').prop('disabled', false)
            perm_table.find('.perm_checkbox').prop('checked', false)

            //change name on table:
            $(`#${id_prefix}_header_username`).text(username)

            // Get permissions:
            let all_perms = get_total_permissions(path_to_file[filepath], username)
            for( ace_type in all_perms) { // 'allow' and 'deny'
                for(allowed_perm in all_perms[ace_type]) {
                    let p_id = allowed_perm.replace(/[ \/]/g, '_') 
                    let checkbox = perm_table.find(`#${id_prefix}_${p_id}_${ace_type}_checkbox`)
                    checkbox.prop('checked', true)
                    // TEMPORARILY DISABLED - testing group inheritance warning
                    // if(all_perms[ace_type][allowed_perm].inherited) {
                    //     // can't uncheck inherited permissions.
                    //     checkbox.prop('disabled', true)
                    // }
                }
            }
        }
        else {
            // can't get permissions for this username/filepath - reset everything into a blank state
            perm_table.find('.perm_checkbox').prop('disabled', true)
            perm_table.find('.perm_checkbox').prop('checked', false)
            $(`#${id_prefix}_header_username`).text('')
        }
    }

    define_attribute_observer(perm_table, 'username', update_perm_table)
    define_attribute_observer(perm_table, 'filepath', update_perm_table)

    //Update permissions when checkbox is clicked:
    perm_table.find('.perm_checkbox').change(function(){
        console.log(perm_table.attr('filepath'), perm_table.attr('username'), $(this).attr('permission'), $(this).attr('ptype'), $(this).prop('checked'))
        toggle_permission( perm_table.attr('filepath'), perm_table.attr('username'), $(this).attr('permission'), $(this).attr('ptype'), $(this).prop('checked'))
        update_perm_table()// reload checkboxes
    })

    return perm_table
}

// Define a list of permission groups for a given file, for all users
function define_file_permission_groups_list(id_prefix){

    let perm_list= $(`
        <table id="${id_prefix}" class="ui-widget-content" width="100%">
            <tr id="${id_prefix}_header">
                <th id="${id_prefix}_header_type">Type</th>
                <th id="${id_prefix}_header_name">Name</th>
                <th id="${id_prefix}_header_permission">Permission</th>
                <th id="${id_prefix}_header_inherited">Inherited from</th>
            </tr>
        </table>
    `)

    let update_perm_list = function(){
        $(`#${id_prefix} tr:gt(0)`).remove() // remove all old permission stuff - all but the first (title) row of the table.

        let filepath = perm_list.attr('filepath')
        console.log(filepath)

        if(filepath && filepath.length > 0 && (filepath in path_to_file)) {

            console.log('filepath')

            let file_obj = path_to_file[filepath]
            let users = get_file_users(file_obj)
            for(let u in users) {
                let grouped_perms = get_grouped_permissions(file_obj, u)
                for(let ace_type in grouped_perms) {
                    for(let perm in grouped_perms[ace_type]) {
                        perm_list.append(`<tr id="${id_prefix}_${file_obj.filename}__${u}_${ace_type}_${perm}">
                            <td id="${id_prefix}_${file_obj.filename}__${u}_${ace_type}_${perm}_type">${ace_type}</td>
                            <td id="${id_prefix}_${file_obj.filename}__${u}_${ace_type}_${perm}_name">${u}</td>
                            <td id="${id_prefix}_${file_obj.filename}__${u}_${ace_type}_${perm}_permission">${perm}</td>
                            <td id="${id_prefix}_${file_obj.filename}__${u}_${ace_type}_${perm}_type">${grouped_perms[ace_type][perm].inherited?"Parent Object":"(not inherited)"}</td>
                        </tr>`)
                    }
                }
            }
        }

    }

    define_attribute_observer(perm_list, 'filepath', update_perm_list)

    return perm_list
}


// -- a general-purpose User Select dialog which can be opened when we need to select a user. -- 

// Make a selectable list which will store all of the users, and automatically keep track of which one is selected.
all_users_selectlist = define_single_select_list('user_select_list')

// Make the elements which reperesent all users, and add them to the selectable
all_user_elements = make_user_list('user_select', all_users)
all_users_selectlist.append(all_user_elements)

// Make the dialog:
user_select_dialog = define_new_dialog('user_select_dialog2', 'Select User', {
    buttons: {
        Cancel: {
            text: "Cancel",
            id: "user_select_cancel_button",
            click: function() {
                $( this ).dialog( "close" );
            },
        },
        OK: {
            text: "OK",
            id: "user_select_ok_button",
            click: function() {
                // When "OK" is clicked, we want to populate some other element with the selected user name 
                //(to pass along the selection information to whoever opened this dialog)
                let to_populate_id = $(this).attr('to_populate') // which field do we need to populate?
                // console.log("populate id " + to_populate_id);
                let selected_value = all_users_selectlist.attr('selected_item') // what is the user name that was selected?
                // console.log("selected item " + selected_value);
                $(`#${to_populate_id}`).attr('selected_user', selected_value) // populate the element with the id
                $( this ).dialog( "close" );
            }
        }
    }
})

// add stuff to the dialog:
user_select_dialog.append(all_users_selectlist)

// Call this function whenever you need a user select dialog; it will automatically populate the 'selected_user' attribute of the element with id to_populate_id
function open_user_select_dialog(to_populate_id) {
    // TODO: reset selected user?..

    user_select_dialog.attr('to_populate', to_populate_id)
    user_select_dialog.dialog('open')
}

// define a new user-select field which opens up a user-select dialog and stores the result in its own selected_user attribute.
// The resulting jquery element contains a field and a button. The field's text also gets populated with the selected user.
// - id_prefix is the required id prefix that will be attached to all element ids.
// - select_button_text is the text that will go on the button
// - on_user_change is an additional function you can pass in, which will be called each time a user is selected.
function define_new_user_select_field(id_prefix, select_button_text, on_user_change = function(selected_user){}){
    // Make the element:
    let sel_section = $(`<div id="${id_prefix}_line" class="section">
            <span id="${id_prefix}_field" class="ui-widget-content" style="width: 80%;display: inline-block;">&nbsp</span>
            <button id="${id_prefix}_button" class="ui-button ui-widget ui-corner-all">${select_button_text}</button>
        </div>`)

    // Open user select on button click:
    sel_section.find(`#${id_prefix}_button`).click(function(){
        open_user_select_dialog(`${id_prefix}_field`)
    })

    // Set up an observer to watch the attribute change and change the field
    let field_selector = sel_section.find(`#${id_prefix}_field`)
    define_attribute_observer(field_selector, 'selected_user', function(new_username){
        field_selector.text(new_username)
        // call the function for additional processing of user change:
        on_user_change(new_username)
    })

    return sel_section
}

//---- misc. ----

// Get a (very simple) text representation of a permissions explanation
function get_explanation_text(explanation) {
    return `
    Action allowed?: ${explanation.is_allowed}; 
    Because of
    permission set for file: ${explanation.file_responsible?get_full_path(explanation.file_responsible):'N/A'}
    and for user: ${ explanation.ace_responsible ? get_user_name(explanation.ace_responsible.who) : 'N/A' }
    ${ explanation.text_explanation ? `(${explanation.text_explanation})`  : '' }
    `
}

//---- some universal HTML set-up so you don't have to do it in each wrapper.html ----
$('#filestructure').css({
    'display':'inline-block',
    'width':'49%',
    'vertical-align': 'top'
})
$('#filestructure').after('<div id="sidepanel" style="display:inline-block;width:49%"></div>')