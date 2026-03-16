/**
 * Bus vol Bikes - Gutenberg Block
 */
(function(wp) {
    const { registerBlockType } = wp.blocks;
    const { InspectorControls } = wp.editor;
    const { PanelBody, RangeControl, SelectControl } = wp.components;
    const { Fragment } = wp.element;
    
    registerBlockType('busvolbikes/voorraad', {
        title: 'Bus vol Bikes - Voorraad',
        icon: 'bicycle',
        category: 'widgets',
        
        attributes: {
            limit: {
                type: 'number',
                default: 0
            },
            filter: {
                type: 'string',
                default: 'all'
            }
        },
        
        edit: function(props) {
            const { attributes, setAttributes } = props;
            const { limit, filter } = attributes;
            
            return wp.element.createElement(Fragment, {},
                wp.element.createElement(InspectorControls, {},
                    wp.element.createElement(PanelBody, {
                        title: 'Instellingen',
                        initialOpen: true
                    },
                        wp.element.createElement(RangeControl, {
                            label: 'Aantal fietsen (0 = alle)',
                            value: limit,
                            onChange: function(value) {
                                setAttributes({ limit: value });
                            },
                            min: 0,
                            max: 20
                        }),
                        wp.element.createElement(SelectControl, {
                            label: 'Standaard filter',
                            value: filter,
                            options: [
                                { label: 'Alle fietsen', value: 'all' },
                                { label: 'Gebruikt', value: 'gebruikt' },
                                { label: 'Nieuw', value: 'nieuw' }
                            ],
                            onChange: function(value) {
                                setAttributes({ filter: value });
                            }
                        })
                    )
                ),
                wp.element.createElement('div', {
                    className: 'bvb-block-preview',
                    style: {
                        padding: '20px',
                        background: '#f8fafc',
                        borderRadius: '8px',
                        textAlign: 'center'
                    }
                },
                    wp.element.createElement('span', {
                        style: { fontSize: '40px' }
                    }, '🚲'),
                    wp.element.createElement('p', {}, 'Bus vol Bikes - Voorraad'),
                    wp.element.createElement('p', {
                        style: { fontSize: '12px', color: '#64748b' }
                    }, limit > 0 ? 'Toont ' + limit + ' fietsen' : 'Toont alle fietsen')
                )
            );
        },
        
        save: function() {
            // Server-side rendering via PHP
            return null;
        }
    });
})(window.wp);
