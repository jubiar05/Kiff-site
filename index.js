const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());

const total = new Map();
const shareHistory = [];

app.get('/total', async (req, res) => {
  try {
    const data = Array.from(total.values()).map((link, index) => ({
      session: index + 1,
      url: link.url,
      count: link.count,
      id: link.id,
      target: link.target,
    }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/share-history', (req, res) => {
  try {
    res.json(shareHistory);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/submit', async (req, res) => {
  try {
    const { accessToken, url, amount, interval } = req.body;
    if (!accessToken || !url || !amount || !interval) {
      throw new Error('Missing access token, url, amount, or interval');
    }

    await share(accessToken, url, amount, interval);

    res.status(200).json({ status: 200, accessToken });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function share(accessToken, url, amount, interval) {
  try {
    const id = await getPostID(url);
    if (!id) {
      throw new Error("Unable to get link id: invalid URL, it's either a private post or visible to friends only");
    }

    const postId = total.has(id) ? id + 1 : id;
    total.set(postId, {
      url,
      id,
      count: 0,
      target: amount,
    });

    let sharedCount = 0;
    const timer = setInterval(async () => {
      try {
        const response = await fetch(`https://graph.facebook.com/me/feed?link=https://m.facebook.com/${id}&published=0&access_token=${accessToken}`, { method: 'POST' });
        if (!response.ok) {
          throw new Error(`Failed to share post: ${response.status} - ${response.statusText}`);
        }

        total.set(postId, {
          ...total.get(postId),
          count: total.get(postId).count + 1,
        });

        sharedCount++;

        if (sharedCount === amount) {
          clearInterval(timer);
        }
      } catch (error) {
        clearInterval(timer);
        total.delete(postId);
        throw new Error(`Error sharing post: ${error.message}`);
      }
    }, interval * 1000);

    setTimeout(() => {
      clearInterval(timer);
      total.delete(postId);
    }, amount * interval * 1000);

    // Add to share history
    shareHistory.push({ accessToken, url, amount, interval });
  } catch (error) {
    throw new Error(`Error initiating sharing process: ${error.message}`);
  }
}

async function getPostID(url) {
  try {
    const response = await fetch('https://id.traodoisub.com/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `link=${encodeURIComponent(url)}`
    });
    const data = await response.json();
    return data.id;
  } catch (error) {
    throw new Error('Failed to get post ID: ' + (error.message || 'Unknown error'));
  }
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
        
