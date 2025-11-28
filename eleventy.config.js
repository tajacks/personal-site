import fs from 'fs';
import yaml from 'js-yaml';
import syntaxHighlight from '@11ty/eleventy-plugin-syntaxhighlight';

export default function(eleventyConfig) {
  // Add syntax highlighting plugin
  eleventyConfig.addPlugin(syntaxHighlight);
  // Add YAML support for data files
  eleventyConfig.addDataExtension("yaml", contents => yaml.load(contents));
  // Pass through static assets
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  // Watch for CSS changes
  eleventyConfig.addWatchTarget("src/css/");

  // Create notes collection
  eleventyConfig.addCollection("notes", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/notes/*.md").sort((a, b) => {
      return (b.data.updated || b.date) - (a.data.updated || a.date);
    });
  });

  // Group notes by category
  eleventyConfig.addCollection("notesByCategory", function(collectionApi) {
    const notes = collectionApi.getFilteredByGlob("src/notes/*.md");
    const categoryMap = {};

    notes.forEach(note => {
      const category = note.data.category || 'Uncategorized';
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      categoryMap[category].push(note);
    });

    // Sort categories alphabetically and notes within each category by title
    const sortedCategories = Object.keys(categoryMap).sort();
    const result = sortedCategories.map(category => ({
      category: category,
      notes: categoryMap[category].sort((a, b) => a.data.title.localeCompare(b.data.title))
    }));

    return result;
  });


  // Add a filter for the current year (useful for copyright)
  eleventyConfig.addFilter("year", () => new Date().getFullYear());

  // Add a filter for formatting dates
  eleventyConfig.addFilter("dateFormat", (date) => {
    const d = new Date(date);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
  });

  // Add a filter for month/year format
  eleventyConfig.addFilter("monthYear", (date) => {
    const d = new Date(date);
    const options = { year: 'numeric', month: 'short' };
    return d.toLocaleDateString('en-US', options);
  });

  // Add a filter for ISO date format (for datetime attribute)
  eleventyConfig.addFilter("isoDate", (date) => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  });

  // Get unique years from books array, sorted descending
  eleventyConfig.addFilter("bookYears", (books) => {
    const years = books.map(b => b.year).filter(y => y != null);
    return [...new Set(years)].sort((a, b) => b - a);
  });

  // Filter books by year
  eleventyConfig.addFilter("byYear", (books, year) => {
    return books.filter(b => b.year === year);
  });

  // Filter books by status
  eleventyConfig.addFilter("byStatus", (books, status) => {
    return books.filter(b => b.status === status);
  });

  // Filter books without a year
  eleventyConfig.addFilter("withoutYear", (books) => {
    return books.filter(b => !b.year);
  });

  // Map book category to icon
  eleventyConfig.addFilter("bookIcon", (category) => {
    const icons = {
      'fiction': '📖',
      'technical': '💻',
      'self-help': '💡',
      'philosophy': '🤔',
      'non-fiction': '📚',
      'science': '🔬',
      'food-drink': '☕'
    };
    return icons[category] || '📚';
  });

  // Get all unique tags from notes
  eleventyConfig.addFilter("getAllTags", (collection) => {
    let tagSet = new Set();
    collection.forEach(item => {
      if (item.data.tags) {
        item.data.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  });

  // Filter notes by tag
  eleventyConfig.addFilter("filterByTag", (collection, tag) => {
    if (!tag) return collection;
    return collection.filter(item => {
      return item.data.tags && item.data.tags.includes(tag);
    });
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data"
    },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
}
