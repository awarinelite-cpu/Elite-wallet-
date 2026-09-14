/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				ink: '#0F1B2B', // base background — deep ledger navy
				surface: '#16243A', // card / panel surface
				surface2: '#1D3049', // raised surface (modals, inputs)
				hair: '#2A3C56', // hairline borders / dividers
				emerald: {
					DEFAULT: '#1B8A5A',
					dim: '#155C3D',
					bright: '#28B577'
				},
				gold: {
					DEFAULT: '#D4A73D',
					dim: '#A9822D'
				},
				danger: '#E1523D',
				pending: '#D4A73D',
				reversed: '#7C8BA3',
				ash: {
					DEFAULT: '#EAEFF5', // primary text
					muted: '#8C9AB3', // secondary text
					faint: '#5B6B85' // tertiary / placeholder
				}
			},
			fontFamily: {
				display: ['"Space Grotesk"', 'sans-serif'],
				body: ['"Inter"', 'sans-serif']
			},
			borderRadius: {
				card: '14px',
				pill: '999px'
			},
			backgroundImage: {
				band: 'linear-gradient(135deg, #14385F 0%, #0F1B2B 62%)'
			}
		}
	},
	plugins: []
};
