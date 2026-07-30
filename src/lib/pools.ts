// Themed pools to bid over. Add more freely — the engine just needs a list of names.
export const POOLS: Record<string, string[]> = {
	'NBA GOATs': [
		'Michael Jordan', 'LeBron James', 'Kareem Abdul-Jabbar', 'Magic Johnson', 'Larry Bird',
		'Kobe Bryant', 'Tim Duncan', 'Shaquille O’Neal', 'Wilt Chamberlain', 'Bill Russell',
		'Stephen Curry', 'Kevin Durant', 'Hakeem Olajuwon', 'Nikola Jokić', 'Giannis Antetokounmpo',
		'Luka Dončić', 'Dirk Nowitzki', 'Allen Iverson', 'Steve Nash', 'Charles Barkley',
		'Jason Kidd', 'Scottie Pippen', 'Dwyane Wade', 'Kevin Garnett'
	],
	Avengers: [
		'Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow', 'Hawkeye',
		'Spider-Man', 'Doctor Strange', 'Black Panther', 'Scarlet Witch', 'Vision',
		'Ant-Man', 'Wasp', 'Falcon', 'Winter Soldier', 'Star-Lord', 'Gamora', 'Groot'
	],
	'Premier League': [
		'Erling Haaland', 'Mohamed Salah', 'Kevin De Bruyne', 'Bukayo Saka', 'Son Heung-min',
		'Bruno Fernandes', 'Cole Palmer', 'Declan Rice', 'Virgil van Dijk', 'Rodri',
		'Martin Ødegaard', 'Alexander Isak', 'Phil Foden', 'Marcus Rashford', 'Trent Alexander-Arnold',
		'Bernardo Silva', 'William Saliba', 'James Maddison'
	]
};

export const POOL_NAMES = Object.keys(POOLS);
