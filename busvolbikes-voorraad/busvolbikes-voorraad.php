<?php
/**
 * Plugin Name: Bus vol Bikes - Voorraad
 * Description: Toont de actuele fietsenvoorraad van Bus vol Bikes in WordPress
 * Version: 1.0.0
 * Author: Bus vol Bikes
 * Author URI: https://busvolbikes-website-production.up.railway.app
 * Text Domain: busvolbikes-voorraad
 */

// Voorkom directe toegang
if (!defined('ABSPATH')) {
    exit;
}

// Definieer plugin constanten
define('BVB_VERSION', '1.0.0');
define('BVB_PLUGIN_URL', plugin_dir_url(__FILE__));
define('BVB_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Laad plugin styles en scripts
 */
function bvb_enqueue_assets() {
    wp_enqueue_style(
        'bvb-voorraad-style',
        BVB_PLUGIN_URL . 'assets/voorraad.css',
        [],
        BVB_VERSION
    );
    
    wp_enqueue_script(
        'bvb-voorraad-script',
        BVB_PLUGIN_URL . 'assets/voorraad.js',
        [],
        BVB_VERSION,
        true
    );
    
    // Data doorgeven aan JavaScript
    wp_localize_script('bvb-voorraad-script', 'bvbData', [
        'apiUrl' => 'https://busvolbikes-website-production.up.railway.app/fietsen-data.json',
        'strings' => [
            'loading' => __('Fietsen laden...', 'busvolbikes-voorraad'),
            'error' => __('Fietsen konden niet worden geladen.', 'busvolbikes-voorraad'),
            'noResults' => __('Geen fietsen gevonden met dit filter.', 'busvolbikes-voorraad'),
            'all' => __('Alle fietsen', 'busvolbikes-voorraad'),
            'used' => __('Gebruikt', 'busvolbikes-voorraad'),
            'new' => __('Nieuw', 'busvolbikes-voorraad'),
            'view' => __('Bekijken →', 'busvolbikes-voorraad'),
            'available' => __('fietsen beschikbaar', 'busvolbikes-voorraad'),
            'lastUpdate' => __('Laatste update:', 'busvolbikes-voorraad')
        ]
    ]);
}
add_action('wp_enqueue_scripts', 'bvb_enqueue_assets');

/**
 * Shortcode: [busvolbikes_voorraad]
 */
function bvb_voorraad_shortcode($atts) {
    $atts = shortcode_atts([
        'limit' => 0, // 0 = alle fietsen
        'filter' => 'all' // all, gebruikt, nieuw
    ], $atts, 'busvolbikes_voorraad');
    
    ob_start();
    ?>
    <div class="bvb-voorraad" data-limit="<?php echo esc_attr($atts['limit']); ?>" data-filter="<?php echo esc_attr($atts['filter']); ?>">
        
        <!-- Stats -->
        <div class="bvb-stats">
            <span id="bvb-fietsen-count"><?php _e('Fietsen laden...', 'busvolbikes-voorraad'); ?></span>
            <span class="bvb-update-time" id="bvb-update-time"></span>
        </div>
        
        <!-- Filters -->
        <div class="bvb-filters">
            <button class="bvb-filter-btn active" data-filter="all"><?php _e('Alle fietsen', 'busvolbikes-voorraad'); ?></button>
            <button class="bvb-filter-btn" data-filter="gebruikt"><?php _e('Gebruikt', 'busvolbikes-voorraad'); ?></button>
            <button class="bvb-filter-btn" data-filter="nieuw"><?php _e('Nieuw', 'busvolbikes-voorraad'); ?></button>
        </div>
        
        <!-- Grid -->
        <div class="bvb-grid" id="bvb-fietsen-grid">
            <div class="bvb-loading">🚲 <?php _e('Fietsen worden geladen...', 'busvolbikes-voorraad'); ?></div>
        </div>
        
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('busvolbikes_voorraad', 'bvb_voorraad_shortcode');

/**
 * Widget registreren
 */
function bvb_register_widget() {
    register_widget('BVB_Voorraad_Widget');
}
add_action('widgets_init', 'bvb_register_widget');

/**
 * Voorraad Widget Class
 */
class BVB_Voorraad_Widget extends WP_Widget {
    
    public function __construct() {
        parent::__construct(
            'bvb_voorraad_widget',
            __('Bus vol Bikes - Voorraad', 'busvolbikes-voorraad'),
            ['description' => __('Toont fietsenvoorraad in je sidebar', 'busvolbikes-voorraad')]
        );
    }
    
    public function widget($args, $instance) {
        echo $args['before_widget'];
        
        if (!empty($instance['title'])) {
            echo $args['before_title'] . apply_filters('widget_title', $instance['title']) . $args['after_title'];
        }
        
        $limit = !empty($instance['limit']) ? intval($instance['limit']) : 3;
        echo do_shortcode('[busvolbikes_voorraad limit="' . $limit . '"]');
        
        echo $args['after_widget'];
    }
    
    public function form($instance) {
        $title = !empty($instance['title']) ? $instance['title'] : '';
        $limit = !empty($instance['limit']) ? intval($instance['limit']) : 3;
        ?>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('title')); ?>"><?php _e('Titel:', 'busvolbikes-voorraad'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('title')); ?>" name="<?php echo esc_attr($this->get_field_name('title')); ?>" type="text" value="<?php echo esc_attr($title); ?>">
        </p>
        <p>
            <label for="<?php echo esc_attr($this->get_field_id('limit')); ?>"><?php _e('Aantal fietsen:', 'busvolbikes-voorraad'); ?></label>
            <input class="widefat" id="<?php echo esc_attr($this->get_field_id('limit')); ?>" name="<?php echo esc_attr($this->get_field_name('limit')); ?>" type="number" min="1" max="20" value="<?php echo esc_attr($limit); ?>">
        </p>
        <?php
    }
    
    public function update($new_instance, $old_instance) {
        $instance = [];
        $instance['title'] = (!empty($new_instance['title'])) ? strip_tags($new_instance['title']) : '';
        $instance['limit'] = (!empty($new_instance['limit'])) ? intval($new_instance['limit']) : 3;
        return $instance;
    }
}

/**
 * Gutenberg blok registreren
 */
function bvb_register_block() {
    if (!function_exists('register_block_type')) {
        return;
    }
    
    wp_register_script(
        'bvb-block-editor',
        BVB_PLUGIN_URL . 'assets/block.js',
        ['wp-blocks', 'wp-element', 'wp-editor'],
        BVB_VERSION
    );
    
    register_block_type('busvolbikes/voorraad', [
        'editor_script' => 'bvb-block-editor',
        'render_callback' => 'bvb_render_block',
        'attributes' => [
            'limit' => [
                'type' => 'number',
                'default' => 0
            ],
            'filter' => [
                'type' => 'string',
                'default' => 'all'
            ]
        ]
    ]);
}
add_action('init', 'bvb_register_block');

function bvb_render_block($attributes) {
    return do_shortcode('[busvolbikes_voorraad limit="' . $attributes['limit'] . '" filter="' . $attributes['filter'] . '"]');
}

/**
 * Plugin activeren
 */
function bvb_activate() {
    // Cache legen bij activatie
    wp_cache_flush();
}
register_activation_hook(__FILE__, 'bvb_activate');

/**
 * Plugin deactiveren
 */
function bvb_deactivate() {
    // Cleanup indien nodig
}
register_deactivation_hook(__FILE__, 'bvb_deactivate');
