import { AutoRouter, html } from 'itty-router';

const router = AutoRouter();

function generateState() {
	return `gateway-owned_${crypto.randomUUID()}`;
}

router.get('/oauth/wargaming/authorize',() => html(
	`
	<html>
	<p>Select Account Region</p>
	<a href="/auth/wargaming/redirect?region=com">North America</a>
	<a href="/auth/wargaming/redirect?region=eu">Europe</a>
	<a href="/auth/wargaming/redirect?region=asia">Asia/OCE</a>
	</html>
		`
) )

// Root route to initiate OAuth flow
router.get('/auth/wargaming/redirect', async (req, env, ctx) => {
	const state = req.query.state ? req.query.state : generateState();
	const redirectUri = `http://${req.headers.get('host')}/auth/wargaming/callback?state=${state}`;
	const clientId = env.WARGAMING_APPLICATION_ID; // Wargaming application ID

	// Store the state in KV for later validation
	await env.OAuthStateKeys.put(`oauth-state-${state}`, 'true', { expirationTtl: 600 }); // Expires in 10 minutes

	// Redirect user to Wargaming's authorization endpoint
	const authUrl = `https://api.worldoftanks.${req.query.region}/wot/auth/login/?application_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&nofollow=0`;
	return Response.redirect(authUrl);
});

// Callback route to handle the redirect from Wargaming
router.get('/auth/wargaming/callback', async (req, env, ctx) => {
	const url = new URL(req.url);
	const access_token = url.searchParams.get('access_token');
	const state = url.searchParams.get('state');

	// Validate the state parameter
	const validState = await env.OAuthStateKeys.get(`oauth-state-${state}`);
	if (!validState) {
		return new Response('Invalid state parameter', { status: 403 });
	}

	// Cleanup state from KV
	//await env.OAuthStateKeys.delete(`oauth-state-${state}`);

	const r = await fetch(`https://api.worldoftanks.asia/wgn/account/info/?application_id=${env.WARGAMING_APPLICATION_ID}&account_id=${url.searchParams.get('account_id')}&access_token=${access_token}`);
	const userData = await r.json();
	console.log(userData)
	return new Response(`Authorization successful, code: ${access_token}. User Data: ${userData}`);
});

// Fallback
router.all('*', () => new Response('Not Found.', { status: 404 }));

export default { ...router }
