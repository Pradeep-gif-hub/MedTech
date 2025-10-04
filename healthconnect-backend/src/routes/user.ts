import { Router } from 'express';
import fetch from 'node-fetch';

const router = Router();

router.get('/profile-image', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Try to get Google profile image
    const googleProfileUrl = `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${req.headers.authorization}`;
    
    try {
      const response = await fetch(googleProfileUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.picture) {
          return res.json({ imageUrl: data.picture });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch Google profile', e);
    }

    // If Google fetch fails, try Gravatar as fallback
    const md5 = require('md5');
    const hash = md5(email.toString().toLowerCase().trim());
    const gravatarUrl = `https://www.gravatar.com/avatar/${hash}?d=404&s=200`;

    res.json({ imageUrl: gravatarUrl });
  } catch (error) {
    console.error('Profile image fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile image' });
  }
});

export default router;
