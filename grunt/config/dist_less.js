module.exports = function (grunt, data) {
    'use strict';

    var config = {
        copy: {
            dist_less: {
                __groups: ['dist_css'],
                src: ['<%= paths.src %>/lib/**/*.less'],
                dest: '<%= paths.dist %>/',
                flatten: true,
                expand: true
            }
        }
    };

    return config;
};
