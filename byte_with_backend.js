// Globals
let currentCategory = '';
let refreshInterval = null;

// Dark Mode Toggle with Remembering State
function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem("darkMode", document.body.classList.contains("dark-mode"));
}

// Load dark mode state from storage
if (localStorage.getItem("darkMode") === "true") {
  document.body.classList.add("dark-mode");
}

// Show/Hide Loader
function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'block';
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) loader.style.display = 'none';
}

// Capitalize function
function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Render article reusable function
function renderArticle(article) {
  const imageUrl = article.image || article.image_url || '';
  return `
    <div style="margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #ccc;">
      ${imageUrl ? `<img src="${imageUrl}" alt="News Image" onerror="this.style.display='none'" style="max-width:100%; max-height:300px; object-fit:cover; border-radius: 8px; margin: 10px 0;" />` : ''}
      <h3><a href="${article.url}" target="_blank" style="color:#1e3a8a;">${article.title}</a></h3>
      <p>${article.description || 'No description available.'}</p>
      <a href="${article.url}" target="_blank" class="read-more-btn">Read More</a><br/>
      <small style="color: gray;">Source: ${article.source?.name || 'Unknown'}</small>
    </div>`;
}

// Render summary card function
function renderSummaryCard(article, summary) {
  const imageUrl = article.image || article.image_url || '';
  return `
    <div style="margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #ccc;">
      ${imageUrl ? `<img src="${imageUrl}" alt="News Image" onerror="this.style.display='none'" style="max-width:100%; max-height:300px; object-fit:cover; border-radius: 8px; margin: 10px 0;" />` : ''}
      <h3><a href="${article.url}" target="_blank" style="color:#1e3a8a;">${article.title}</a></h3>
      <div class="summary-box" style="background:#f1f5f9; color:#1e293b; padding:12px; border-left:4px solid #1e3a8a; margin:10px 0; border-radius:4px;">
        <strong>Summary:</strong> ${summary}
      </div>
      <a href="${article.url}" target="_blank" class="read-more-btn">Read More</a><br/>
      <small style="color: gray;">Source: ${article.source?.name || 'Unknown'}</small>
    </div>`;
}

// Auto-refresh
function autoRefresh(category) {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => loadCategory(category), 5 * 60 * 1000);
}

// Main function to load categories
async function loadCategory(category) {
  currentCategory = category;
  autoRefresh(category);
  showLoader();
  const container = document.getElementById('news-container');
  container.innerHTML = `<h2>${capitalize(category)} News</h2><p>Loading...</p>`;

  try {
    let response;

    if (category === 'trending') {
      const apiKey = '6c8e0dd7de4cd667015e9a68a1876c0f';
      response = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&lang=en&country=in&max=10&apikey=${apiKey}`);
    } else if (category === 'summary') {
      response = await fetch(`http://127.0.0.1:5000/news?category=general`);
    } else {
      response = await fetch(`http://127.0.0.1:5000/news?category=${category}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.articles || !Array.isArray(data.articles) || data.articles.length === 0) {
      container.innerHTML = `<h2>${capitalize(category)} News</h2><p>No articles found.</p>`;
      hideLoader();
      return;
    }

    // Process Summaries for top 3 articles for high performance
    if (category === 'summary') {
      container.innerHTML = `<h2>Summary News</h2>`;
      
      const articlesToSummarize = data.articles.slice(0, 3);
      const remainingArticles = data.articles.slice(3);

      const summaryPromises = articlesToSummarize.map(article => 
        summarizeArticle(article.content || article.description || article.title)
      );
      
      const summaries = await Promise.all(summaryPromises);

      let contentHtml = '<h2>Summary News</h2>';
      
      articlesToSummarize.forEach((article, index) => {
        contentHtml += renderSummaryCard(article, summaries[index]);
      });

      remainingArticles.forEach(article => {
        contentHtml += renderArticle(article);
      });

      container.innerHTML = contentHtml;

    } else if (category === 'trending') {
      let contentHtml = '<h2>Trending News</h2>';
      data.articles.forEach(article => contentHtml += renderArticle(article));
      container.innerHTML = contentHtml;

    } else {
      let articlesToDisplay = data.articles;

      try {
        const filterResponse = await fetch(`http://127.0.0.1:5000/filter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, articles: data.articles })
        });
        
        if (filterResponse.ok) {
          const filtered = await filterResponse.json();
          if (filtered.articles && filtered.articles.length > 0) {
            articlesToDisplay = filtered.articles;
          }
        }
      } catch (filterErr) {
        console.warn('Filter service unreachable, using raw articles:', filterErr);
      }

      let contentHtml = `<h2>${capitalize(category)} News</h2>`;
      articlesToDisplay.forEach(article => contentHtml += renderArticle(article));
      container.innerHTML = contentHtml;
    }

  } catch (error) {
    console.error('Error loading news:', error);
    container.innerHTML = `<h2>${capitalize(category)} News</h2><p>Error loading articles.</p>`;
  }

  hideLoader();
}

// Summarization function
async function summarizeArticle(content) {
  try {
    const response = await fetch('http://127.0.0.1:5000/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) return 'Summarization unavailable.';
    
    const data = await response.json();
    return data.summary || 'Summarization failed.';
  } catch (error) {
    console.error('Summarization error:', error);
    return 'Summarization failed.';
  }
}

// Search Function
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('keypress', async function (e) {
    if (e.key === 'Enter') {
      const query = this.value.trim();
      if (!query) return;

      showLoader();
      const container = document.getElementById('news-container');
      container.innerHTML = `<h2>Search Results for "${query}"</h2><p>Loading...</p>`;

      try {
        const response = await fetch(`http://127.0.0.1:5000/search?query=${encodeURIComponent(query)}`);
        
        if (!response.ok) throw new Error('Search request failed');
        
        const data = await response.json();

        if (!data.articles || data.articles.length === 0) {
          container.innerHTML = `<h2>Search Results for "${query}"</h2><p>No articles found.</p>`;
          hideLoader();
          return;
        }

        let contentHtml = `<h2>Search Results for "${query}"</h2>`;
        data.articles.forEach(article => contentHtml += renderArticle(article));
        container.innerHTML = contentHtml;

      } catch (error) {
        console.error('Search error:', error);
        container.innerHTML = `<h2>Search Results for "${query}"</h2><p>Error loading search results.</p>`;
      }

      hideLoader();
    }
  });
}