// Themed pools to bid over. Add more freely — the engine just needs a list of names.
// (User-created pools come later; this is the built-in library.)
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
	],
	'Pokémon (Gen 1)': [
		'Charizard', 'Blastoise', 'Venusaur', 'Pikachu', 'Mewtwo', 'Mew', 'Gengar', 'Snorlax',
		'Dragonite', 'Gyarados', 'Alakazam', 'Machamp', 'Lapras', 'Eevee', 'Jolteon', 'Vaporeon',
		'Arcanine', 'Zapdos', 'Articuno', 'Moltres', 'Ditto', 'Squirtle'
	],
	'Star Wars': [
		'Luke Skywalker', 'Darth Vader', 'Yoda', 'Obi-Wan Kenobi', 'Han Solo', 'Leia Organa',
		'Chewbacca', 'Emperor Palpatine', 'Boba Fett', 'Darth Maul', 'Rey', 'Kylo Ren',
		'Ahsoka Tano', 'Grogu', 'Mace Windu', 'Padmé Amidala', 'R2-D2', 'C-3PO', 'The Mandalorian', 'General Grievous'
	],
	'Rap GOATs': [
		'Tupac', 'The Notorious B.I.G.', 'Jay-Z', 'Nas', 'Eminem', 'Kendrick Lamar', 'Andre 3000',
		'Rakim', 'Lil Wayne', 'Kanye West', 'Drake', 'Snoop Dogg', 'Dr. Dre', 'J. Cole',
		'Ice Cube', 'Method Man', 'Ghostface Killah', 'DMX', 'Missy Elliott', 'Lauryn Hill'
	],
	'F1 Drivers': [
		'Max Verstappen', 'Lewis Hamilton', 'Michael Schumacher', 'Ayrton Senna', 'Alain Prost',
		'Sebastian Vettel', 'Fernando Alonso', 'Charles Leclerc', 'Lando Norris', 'Niki Lauda',
		'Jim Clark', 'Jackie Stewart', 'Nigel Mansell', 'Kimi Räikkönen', 'Jenson Button', 'Oscar Piastri'
	],
	'Fast Food': [
		'McDonald’s', 'In-N-Out', 'Chick-fil-A', 'Taco Bell', 'Wendy’s', 'Five Guys', 'Popeyes',
		'Chipotle', 'Shake Shack', 'Whataburger', 'Raising Cane’s', 'KFC', 'Burger King',
		'Subway', 'Domino’s', 'Culver’s', 'Sonic', 'Arby’s'
	],
	'Movie Villains': [
		'Darth Vader', 'Hannibal Lecter', 'The Joker', 'Thanos', 'Voldemort', 'Sauron', 'Anton Chigurh',
		'Michael Myers', 'Freddy Krueger', 'Norman Bates', 'Hans Gruber', 'Loki', 'Agent Smith',
		'Nurse Ratched', 'Amon Goeth', 'Gollum', 'Pennywise', 'The Terminator'
	],
	'Video Game Heroes': [
		'Mario', 'Link', 'Master Chief', 'Kratos', 'Lara Croft', 'Samus Aran', 'Sonic', 'Cloud Strife',
		'Geralt of Rivia', 'Solid Snake', 'Pac-Man', 'Donkey Kong', 'Steve (Minecraft)', 'Kirby',
		'Ryu', 'Aloy', 'Nathan Drake', 'Mega Man', 'Pikachu', 'Yoshi'
	],
	'Sitcom Characters': [
		'Michael Scott', 'Ron Swanson', 'Barney Stinson', 'Sheldon Cooper', 'Kramer', 'George Costanza',
		'Dwight Schrute', 'Leslie Knope', 'Chandler Bing', 'Phoebe Buffay', 'Homer Simpson', 'Eric Cartman',
		'Charlie Kelly', 'Dennis Reynolds', 'Jake Peralta', 'Creed Bratton', 'Kevin Malone', 'Andy Dwyer'
	],
	'Dog Breeds': [
		'Golden Retriever', 'Labrador', 'German Shepherd', 'Husky', 'Corgi', 'Border Collie',
		'Dachshund', 'French Bulldog', 'Poodle', 'Beagle', 'Rottweiler', 'Great Dane',
		'Shiba Inu', 'Australian Shepherd', 'Doberman', 'Bernese Mountain Dog', 'Pug', 'Chihuahua'
	]
};

export const POOL_NAMES = Object.keys(POOLS);
