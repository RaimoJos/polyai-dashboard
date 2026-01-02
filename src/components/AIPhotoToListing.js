import React, { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * AIPhotoToListing - Generate product listings from print photos
 * Uses AI to analyze images and create compelling descriptions
 */

const LISTING_TEMPLATES = {
  marketplace: {
    name: 'Marketplace',
    icon: '🛒',
    description: 'eBay, Etsy, Amazon',
    format: (data) => `${data.title}

${data.description}

📦 Product Details:
• Material: ${data.material}
• Dimensions: ${data.dimensions}
• Color: ${data.color}
• Finish: ${data.finish}

✨ Features:
${data.features.map(f => `• ${f}`).join('\n')}

🚚 Shipping:
• Ships within 1-3 business days
• Carefully packaged to prevent damage
• International shipping available

💡 Custom Orders:
Need a different size or color? Contact us for custom orders!

⭐ Quality Guarantee:
All products are inspected before shipping. Not satisfied? We'll make it right.

#3Dprinted #custom #handmade ${data.tags.map(t => `#${t}`).join(' ')}`,
  },

  social: {
    name: 'Social Media',
    icon: '📱',
    description: 'Instagram, Facebook',
    format: (data) => `✨ NEW: ${data.title} ✨

${data.shortDescription}

🎨 Made with ${data.material}
📐 Size: ${data.dimensions}

${data.features.slice(0, 3).map(f => `✓ ${f}`).join('\n')}

💬 DM to order or visit link in bio!

${data.tags.slice(0, 10).map(t => `#${t}`).join(' ')} #3Dprinting #maker #custom`,
  },

  website: {
    name: 'Website/Blog',
    icon: '🌐',
    description: 'Product page, blog post',
    format: (data) => `# ${data.title}

${data.description}

## Specifications

| Property | Value |
|----------|-------|
| Material | ${data.material} |
| Dimensions | ${data.dimensions} |
| Color | ${data.color} |
| Finish | ${data.finish} |
| Weight | ${data.weight} |

## Features

${data.features.map(f => `- ${f}`).join('\n')}

## Perfect For

${data.useCases.map(u => `- ${u}`).join('\n')}

## Ordering

Ready to order? [Contact us](/contact) for pricing and availability.

*Custom sizes and colors available upon request.*`,
  },

  email: {
    name: 'Email Campaign',
    icon: '📧',
    description: 'Newsletter, promo email',
    format: (data) => `Subject: New Arrival: ${data.title} 🎉

Hi there,

We're excited to introduce our latest creation: ${data.title}!

${data.shortDescription}

WHAT MAKES IT SPECIAL:
${data.features.slice(0, 4).map(f => `→ ${f}`).join('\n')}

SPECS:
• Material: ${data.material}
• Size: ${data.dimensions}
• Color: ${data.color}

SPECIAL OFFER:
Order this week and get 10% off with code: NEW${data.title.replace(/\s/g, '').slice(0, 6).toUpperCase()}

[Shop Now]

Questions? Just reply to this email!

Best,
The Polywerk Team`,
  },
};

// AI-generated descriptions based on detected features
const AI_DESCRIPTIONS = {
  functional: [
    'Engineered for durability and everyday use',
    'Precision-designed for perfect fit and function',
    'Built to last with high-quality materials',
  ],
  decorative: [
    'Add a touch of elegance to any space',
    'Eye-catching design that makes a statement',
    'Perfect blend of form and function',
  ],
  mechanical: [
    'Precision-engineered moving parts',
    'Smooth operation with tight tolerances',
    'Designed for reliable performance',
  ],
  artistic: [
    'Unique sculptural piece with intricate details',
    'Hand-finished artisan quality',
    'A conversation starter for any room',
  ],
};

function AIPhotoToListing() {
  const [images, setImages] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [productData, setProductData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('marketplace');
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef(null);

  // Handle image upload
  const handleImageUpload = useCallback((e) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error('Please select image files');
      return;
    }

    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImages(prev => [...prev, {
          id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          dataUrl: event.target.result,
          name: file.name,
        }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  // Remove image
  const removeImage = (imageId) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Analyze images and generate listing data
  const analyzeImages = async () => {
    if (images.length === 0) {
      toast.error('Upload at least one image first');
      return;
    }

    setAnalyzing(true);
    
    // Simulate AI analysis (in production, this would call a real API)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock AI analysis results
    const category = detectCategory();
    const aiDescriptions = AI_DESCRIPTIONS[category] || AI_DESCRIPTIONS.functional;
    
    const generatedData = {
      title: generateTitle(),
      description: aiDescriptions[Math.floor(Math.random() * aiDescriptions.length)] + '. ' + generateDescription(),
      shortDescription: generateShortDescription(),
      material: detectMaterial(),
      dimensions: '120mm × 80mm × 45mm',
      color: detectColor(),
      finish: 'Layer lines visible, smooth surfaces',
      weight: '45g',
      features: generateFeatures(category),
      useCases: generateUseCases(category),
      tags: generateTags(category),
      category,
      price: suggestPrice(),
    };

    setProductData(generatedData);
    setAnalyzing(false);
    toast.success('Analysis complete!');
  };

  // Helper functions to generate content
  const generateTitle = () => {
    const adjectives = ['Custom', 'Precision', 'Designer', 'Modern', 'Minimalist', 'Unique'];
    const types = ['3D Printed Part', 'Organizer', 'Holder', 'Stand', 'Container', 'Mount', 'Bracket', 'Case'];
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${types[Math.floor(Math.random() * types.length)]}`;
  };

  const generateDescription = () => {
    const descriptions = [
      'Crafted with attention to detail using premium 3D printing technology.',
      'Designed to meet your exact specifications with precision manufacturing.',
      'A perfect blend of aesthetics and functionality for your space.',
      'Made-to-order with quality materials and careful attention to detail.',
    ];
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  };

  const generateShortDescription = () => {
    return 'High-quality 3D printed product, custom-made with premium materials. Perfect for home or office use.';
  };

  const detectCategory = () => {
    const categories = ['functional', 'decorative', 'mechanical', 'artistic'];
    return categories[Math.floor(Math.random() * categories.length)];
  };

  const detectMaterial = () => {
    const materials = ['PLA (Polylactic Acid)', 'PETG', 'ABS', 'TPU Flexible'];
    return materials[Math.floor(Math.random() * materials.length)];
  };

  const detectColor = () => {
    const colors = ['Matte Black', 'White', 'Gray', 'Blue', 'Red', 'Green', 'Orange'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const generateFeatures = (category) => {
    const allFeatures = {
      functional: ['Durable construction', 'Precise fit', 'Easy to clean', 'Stackable design', 'Non-slip base'],
      decorative: ['Eye-catching design', 'Smooth finish', 'Unique texture', 'Ambient lighting compatible', 'Versatile placement'],
      mechanical: ['Smooth movement', 'Tight tolerances', 'Replaceable parts', 'Easy assembly', 'Lubrication-free'],
      artistic: ['Intricate details', 'Unique design', 'Gallery quality', 'Signed by artist', 'Limited edition'],
    };
    return allFeatures[category] || allFeatures.functional;
  };

  const generateUseCases = (category) => {
    const allUseCases = {
      functional: ['Home organization', 'Office use', 'Workshop storage', 'Daily carry', 'Travel accessories'],
      decorative: ['Living room display', 'Office décor', 'Gift giving', 'Shelf accent', 'Conversation piece'],
      mechanical: ['DIY projects', 'Prototyping', 'Hobby builds', 'Educational demos', 'Custom machines'],
      artistic: ['Art collection', 'Home gallery', 'Corporate art', 'Museum display', 'Investment piece'],
    };
    return allUseCases[category] || allUseCases.functional;
  };

  const generateTags = (category) => {
    const baseTags = ['3dprinted', 'custom', 'handmade', 'maker', 'design'];
    const categoryTags = {
      functional: ['organizer', 'storage', 'practical', 'useful', 'everyday'],
      decorative: ['homedecor', 'decoration', 'art', 'interior', 'aesthetic'],
      mechanical: ['engineering', 'mechanical', 'prototype', 'diy', 'maker'],
      artistic: ['sculpture', 'art', 'unique', 'collectible', 'gallery'],
    };
    return [...baseTags, ...(categoryTags[category] || categoryTags.functional)];
  };

  const suggestPrice = () => {
    return (15 + Math.random() * 35).toFixed(2);
  };

  // Copy listing to clipboard
  const copyListing = () => {
    if (!productData) return;
    
    const template = LISTING_TEMPLATES[selectedTemplate];
    const text = template.format(productData);
    navigator.clipboard.writeText(text);
    toast.success('Listing copied to clipboard!');
  };

  // Get formatted listing
  const getFormattedListing = () => {
    if (!productData) return '';
    return LISTING_TEMPLATES[selectedTemplate].format(productData);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📸 AI Photo → Product Listing
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload photos and generate compelling product descriptions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload & Analysis */}
        <div className="space-y-6">
          {/* Image Upload */}
          <div 
            className="rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition hover:border-purple-500/50"
            style={{ borderColor: images.length > 0 ? '#334155' : '#475569' }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {images.length === 0 ? (
              <>
                <span className="text-4xl">📤</span>
                <p className="text-white font-medium mt-4">Drop photos here</p>
                <p className="text-slate-500 text-sm mt-1">or click to browse</p>
                <p className="text-slate-600 text-xs mt-4">Supports JPG, PNG, WebP</p>
              </>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map(img => (
                  <div key={img.id} className="relative group">
                    <img 
                      src={img.dataUrl} 
                      alt={img.name}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="h-24 rounded-lg border-2 border-dashed border-slate-600 flex items-center justify-center text-slate-500 hover:border-purple-500 hover:text-purple-400">
                  + Add
                </div>
              </div>
            )}
          </div>

          {/* Analyze Button */}
          <button
            onClick={analyzeImages}
            disabled={images.length === 0 || analyzing}
            className={`w-full py-3 rounded-lg font-medium text-white transition ${
              images.length === 0 || analyzing
                ? 'bg-slate-700 cursor-not-allowed'
                : ''
            }`}
            style={images.length > 0 && !analyzing ? { background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' } : {}}
          >
            {analyzing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Analyzing with AI...
              </span>
            ) : (
              '✨ Generate Listing with AI'
            )}
          </button>

          {/* Product Data Editor */}
          {productData && (
            <div className="rounded-xl border p-6 space-y-4" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">📝 Product Details</h3>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`px-3 py-1 rounded-lg text-sm ${editMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-700 text-slate-300'}`}
                >
                  {editMode ? '✓ Done' : '✏️ Edit'}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Title</label>
                  <input
                    type="text"
                    value={productData.title}
                    onChange={(e) => setProductData(prev => ({ ...prev, title: e.target.value }))}
                    disabled={!editMode}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70"
                    style={{ backgroundColor: '#334155' }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Material</label>
                    <input
                      type="text"
                      value={productData.material}
                      onChange={(e) => setProductData(prev => ({ ...prev, material: e.target.value }))}
                      disabled={!editMode}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Color</label>
                    <input
                      type="text"
                      value={productData.color}
                      onChange={(e) => setProductData(prev => ({ ...prev, color: e.target.value }))}
                      disabled={!editMode}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Dimensions</label>
                    <input
                      type="text"
                      value={productData.dimensions}
                      onChange={(e) => setProductData(prev => ({ ...prev, dimensions: e.target.value }))}
                      disabled={!editMode}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Suggested Price</label>
                    <input
                      type="text"
                      value={`€${productData.price}`}
                      onChange={(e) => setProductData(prev => ({ ...prev, price: e.target.value.replace('€', '') }))}
                      disabled={!editMode}
                      className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70"
                      style={{ backgroundColor: '#334155' }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description</label>
                  <textarea
                    value={productData.description}
                    onChange={(e) => setProductData(prev => ({ ...prev, description: e.target.value }))}
                    disabled={!editMode}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm disabled:opacity-70 resize-none"
                    style={{ backgroundColor: '#334155' }}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tags</label>
                  <div className="flex flex-wrap gap-1">
                    {productData.tags.map((tag, i) => (
                      <span 
                        key={i}
                        className="px-2 py-0.5 rounded text-xs bg-purple-500/20 text-purple-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Preview */}
        <div className="space-y-6">
          {/* Template Selection */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(LISTING_TEMPLATES).map(([key, template]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={`p-3 rounded-lg text-center transition ${
                  selectedTemplate === key
                    ? 'bg-purple-500/20 ring-1 ring-purple-500'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                <span className="text-xl">{template.icon}</span>
                <p className="text-white text-sm mt-1">{template.name}</p>
                <p className="text-xs text-slate-500">{template.description}</p>
              </button>
            ))}
          </div>

          {/* Listing Preview */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: '#1e293b', borderColor: '#334155' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#334155' }}>
              <h3 className="font-medium text-white">
                {LISTING_TEMPLATES[selectedTemplate].icon} {LISTING_TEMPLATES[selectedTemplate].name} Preview
              </h3>
              {productData && (
                <button
                  onClick={copyListing}
                  className="px-3 py-1 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                >
                  📋 Copy
                </button>
              )}
            </div>

            <div className="p-4 max-h-[500px] overflow-y-auto">
              {productData ? (
                <pre className="text-slate-300 text-sm whitespace-pre-wrap font-sans">
                  {getFormattedListing()}
                </pre>
              ) : (
                <div className="text-center py-12">
                  <span className="text-4xl">📝</span>
                  <p className="text-slate-500 mt-4">Upload photos and analyze to generate listing</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          {productData && (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyListing}
                className="py-3 rounded-lg font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)' }}
              >
                📋 Copy to Clipboard
              </button>
              <button
                onClick={() => {
                  const blob = new Blob([getFormattedListing()], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `listing-${productData.title.toLowerCase().replace(/\s+/g, '-')}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success('Listing downloaded!');
                }}
                className="py-3 rounded-lg font-medium text-slate-300 border border-slate-600 hover:bg-slate-700"
              >
                📥 Download .txt
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AIPhotoToListing;
