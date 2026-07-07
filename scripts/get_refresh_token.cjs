const http = require('http');
const url = require('url');
const { exec } = require('child_process');
const readline = require('readline');

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}`;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
    console.log('\n======================================================');
    console.log('🔑 OBTENIR UN REFRESH TOKEN GOOGLE OAUTH 2.0');
    console.log('======================================================\n');
    console.log('Avant de commencer, assurez-vous d\'avoir :');
    console.log('1. Créé des identifiants OAuth (Application Web) sur Google Cloud Console.');
    console.log(`2. Ajouté "${REDIRECT_URI}" dans les "URI de redirection autorisés".\n`);

    const clientId = process.env.GOOGLE_CLIENT_ID || await askQuestion('Entrez votre Google Client ID : ');
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || await askQuestion('Entrez votre Google Client Secret : ');

    if (!clientId || !clientSecret || !clientId.trim() || !clientSecret.trim()) {
        console.error('Erreur: Le Client ID et le Client Secret sont requis.');
        process.exit(1);
    }

    // Generate Auth URL
    // Scope: https://www.googleapis.com/auth/drive (Full access to Drive to create/edit files)
    const scope = 'https://www.googleapis.com/auth/drive';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;

    console.log('\n------------------------------------------------------');
    console.log('Étape 1 : Ouvrez le lien suivant dans votre navigateur pour vous connecter :');
    console.log('------------------------------------------------------\n');
    console.log(authUrl);
    console.log('\nTentative d\'ouverture automatique dans votre navigateur...');

    // Open browser automatically
    const startCmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start' : 'xdg-open');
    exec(`${startCmd} "${authUrl.replace(/&/g, '^&')}"`, (err) => {
        if (err) {
            console.log('(Impossible d\'ouvrir automatiquement. Veuillez copier/coller le lien ci-dessus.)');
        }
    });

    console.log('\nEn attente de votre connexion dans le navigateur...');

    // Start local server to capture redirect code
    const server = http.createServer(async (req, res) => {
        const parsedUrl = url.parse(req.url, true);
        
        if (parsedUrl.pathname === '/') {
            const code = parsedUrl.query.code;
            
            if (code) {
                // Respond to user in browser
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html>
                        <body style="font-family: sans-serif; text-align: center; padding-top: 100px; background-color: #f3f4f6;">
                            <div style="display: inline-block; background: white; padding: 40px; rounded: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border-radius: 16px;">
                                <h1 style="color: #10b981;">Connexion Réussie !</h1>
                                <p style="color: #4b5563;">Vous pouvez fermer cet onglet et retourner dans votre terminal.</p>
                            </div>
                        </body>
                    </html>
                `);

                console.log('\nCode d\'autorisation capturé ! Échange avec Google en cours...');

                // Stop server and exchange code
                server.close();
                await exchangeCodeForTokens(code, clientId, clientSecret);
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Code non trouve dans la requete.');
                console.error('Erreur : Redirection recue mais code absent.');
                server.close();
                process.exit(1);
            }
        }
    });

    server.listen(PORT, () => {
        // Server running
    });
}

async function exchangeCodeForTokens(code, clientId, clientSecret) {
    try {
        const bodyParams = new URLSearchParams({
            code: code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: bodyParams.toString()
        });

        const data = await response.json();

        if (data.error) {
            console.error('\n❌ Erreur Google API :', data.error_description || data.error);
            process.exit(1);
        }

        const refreshToken = data.refresh_token;

        if (!refreshToken) {
            console.error('\n❌ Attention : Google n\'a pas renvoyé de Refresh Token.');
            console.log('Cela arrive si vous avez déjà autorisé l\'application auparavant.');
            console.log('Veuillez aller sur https://myaccount.google.com/connections, supprimer l\'accès de votre projet Google Cloud, puis relancer ce script.');
            process.exit(1);
        }

        console.log('\n======================================================');
        console.log('🎉 TOKENS RÉCUPÉRÉS AVEC SUCCÈS !');
        console.log('======================================================\n');
        console.log('Voici les commandes à exécuter pour configurer Supabase :\n');
        
        console.log(`supabase secrets set GOOGLE_CLIENT_ID="${clientId}"`);
        console.log(`supabase secrets set GOOGLE_CLIENT_SECRET="${clientSecret}"`);
        console.log(`supabase secrets set GOOGLE_REFRESH_TOKEN="${refreshToken}"`);
        
        console.log('\nCopiez-collez ces 3 lignes dans votre terminal pour mettre à jour vos secrets Supabase.');
        console.log('======================================================\n');

        process.exit(0);
    } catch (err) {
        console.error('\n❌ Erreur lors de l\'échange de jetons :', err.message);
        process.exit(1);
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
