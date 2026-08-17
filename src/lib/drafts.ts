// Drafts = the biddable lists that make up the market.
// Shared by client + server: the category list, the validation rules, and the built-in seed.

export const CATEGORIES = ['Movies/TV', 'Sports', 'Food', 'Music', 'Video Games', 'Celebrities'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CAT_HUE: Record<Category, string> = {
	'Movies/TV': '#35d07f',
	Sports: '#5b8cff',
	Food: '#ffb020',
	Music: '#ff5f4d',
	'Video Games': '#c46bff',
	Celebrities: '#4dd6ff'
};

export const LIMITS = { title: 40, item: 40, minItems: 4, maxItems: 100 } as const;

// Item is an object, not a string, so cover/per-item art can land later without a migration.
export type Item = { n: string };
export type Draft = {
	id: string;
	title: string;
	category: Category;
	items: Item[];
	author: string;
	plays: number;
	up: number;
	down: number;
	mine: boolean; // created by this browser
	myVote: 1 | -1 | 0;
};

/** Clean + validate a user-submitted item list. Returns null if it can't be salvaged. */
export function cleanItems(raw: unknown): Item[] | null {
	if (!Array.isArray(raw)) return null;
	const seen = new Set<string>();
	const out: Item[] = [];
	for (const v of raw) {
		const n = (typeof v === 'string' ? v : typeof v === 'object' && v && 'n' in v ? String((v as Item).n) : '')
			.trim()
			.slice(0, LIMITS.item);
		if (!n || seen.has(n.toLowerCase())) continue; // drop blanks + dupes rather than erroring
		seen.add(n.toLowerCase());
		out.push({ n });
		if (out.length === LIMITS.maxItems) break;
	}
	return out.length >= LIMITS.minItems ? out : null;
}

export const isCategory = (v: unknown): v is Category => CATEGORIES.includes(v as Category);

// ── Built-in library ──────────────────────────────────────────────────────────
// Topics chosen to match what people actually make lists about; contents written
// from scratch (rosters/facts), not copied from any other site.
type Seed = { title: string; category: Category; items: string[] };

export const SEED: Seed[] = [
	// ── Movies/TV
	{ title: 'Movie Villains', category: 'Movies/TV', items: ['Darth Vader', 'Hannibal Lecter', 'The Joker', 'Thanos', 'Voldemort', 'Sauron', 'Anton Chigurh', 'Michael Myers', 'Freddy Krueger', 'Norman Bates', 'Hans Gruber', 'Loki', 'Agent Smith', 'Nurse Ratched', 'Gollum', 'Pennywise', 'The Terminator', 'Amon Goeth'] },
	{ title: 'The Avengers', category: 'Movies/TV', items: ['Iron Man', 'Captain America', 'Thor', 'Hulk', 'Black Widow', 'Hawkeye', 'Spider-Man', 'Doctor Strange', 'Black Panther', 'Scarlet Witch', 'Vision', 'Ant-Man', 'Wasp', 'Falcon', 'Winter Soldier', 'Star-Lord', 'Gamora', 'Groot'] },
	{ title: 'Star Wars Characters', category: 'Movies/TV', items: ['Luke Skywalker', 'Darth Vader', 'Yoda', 'Obi-Wan Kenobi', 'Han Solo', 'Leia Organa', 'Chewbacca', 'Emperor Palpatine', 'Boba Fett', 'Darth Maul', 'Rey', 'Kylo Ren', 'Ahsoka Tano', 'Grogu', 'Mace Windu', 'Padmé Amidala', 'R2-D2', 'C-3PO', 'The Mandalorian', 'General Grievous'] },
	{ title: 'Sitcom Characters', category: 'Movies/TV', items: ['Michael Scott', 'Ron Swanson', 'Barney Stinson', 'Sheldon Cooper', 'Kramer', 'George Costanza', 'Dwight Schrute', 'Leslie Knope', 'Chandler Bing', 'Phoebe Buffay', 'Homer Simpson', 'Eric Cartman', 'Charlie Kelly', 'Dennis Reynolds', 'Jake Peralta', 'Creed Bratton', 'Kevin Malone', 'Andy Dwyer'] },
	{ title: 'Disney Animated Classics', category: 'Movies/TV', items: ['The Lion King', 'Aladdin', 'Beauty and the Beast', 'The Little Mermaid', 'Mulan', 'Toy Story', 'Finding Nemo', 'The Incredibles', 'Up', 'WALL-E', 'Frozen', 'Moana', 'Tangled', 'Ratatouille', 'Monsters, Inc.', 'Zootopia', 'Encanto', 'Coco'] },
	{ title: 'Prestige TV Dramas', category: 'Movies/TV', items: ['The Sopranos', 'Breaking Bad', 'The Wire', 'Mad Men', 'Game of Thrones', 'Better Call Saul', 'The Shield', 'Deadwood', 'Succession', 'True Detective', 'Fargo', 'The Americans', 'Lost', 'Six Feet Under', 'Boardwalk Empire', 'Ozark'] },

	// ── Sports
	{ title: 'NBA GOATs', category: 'Sports', items: ['Michael Jordan', 'LeBron James', 'Kareem Abdul-Jabbar', 'Magic Johnson', 'Larry Bird', 'Kobe Bryant', 'Tim Duncan', 'Shaquille O’Neal', 'Wilt Chamberlain', 'Bill Russell', 'Stephen Curry', 'Kevin Durant', 'Hakeem Olajuwon', 'Nikola Jokić', 'Giannis Antetokounmpo', 'Luka Dončić', 'Dirk Nowitzki', 'Allen Iverson', 'Steve Nash', 'Charles Barkley'] },
	{ title: 'NFL Quarterbacks All-Time', category: 'Sports', items: ['Tom Brady', 'Joe Montana', 'Peyton Manning', 'John Elway', 'Aaron Rodgers', 'Dan Marino', 'Brett Favre', 'Johnny Unitas', 'Drew Brees', 'Patrick Mahomes', 'Steve Young', 'Terry Bradshaw', 'Roger Staubach', 'Ben Roethlisberger', 'Kurt Warner', 'Josh Allen', 'Lamar Jackson', 'Russell Wilson'] },
	{ title: 'NFL Teams', category: 'Sports', items: ['Kansas City Chiefs', 'San Francisco 49ers', 'Dallas Cowboys', 'Philadelphia Eagles', 'Buffalo Bills', 'Baltimore Ravens', 'Green Bay Packers', 'Detroit Lions', 'Miami Dolphins', 'Cincinnati Bengals', 'Pittsburgh Steelers', 'New England Patriots', 'Seattle Seahawks', 'Minnesota Vikings', 'Houston Texans', 'Los Angeles Rams', 'New York Jets', 'Chicago Bears'] },
	{ title: 'Soccer GOATs', category: 'Sports', items: ['Lionel Messi', 'Cristiano Ronaldo', 'Pelé', 'Diego Maradona', 'Johan Cruyff', 'Ronaldo Nazário', 'Zinedine Zidane', 'Ronaldinho', 'Franz Beckenbauer', 'Alfredo Di Stéfano', 'Thierry Henry', 'Kylian Mbappé', 'Andrés Iniesta', 'Xavi', 'Paolo Maldini', 'Roberto Baggio', 'George Best', 'Erling Haaland'] },
	{ title: 'Premier League Stars', category: 'Sports', items: ['Erling Haaland', 'Mohamed Salah', 'Kevin De Bruyne', 'Bukayo Saka', 'Son Heung-min', 'Bruno Fernandes', 'Cole Palmer', 'Declan Rice', 'Virgil van Dijk', 'Rodri', 'Martin Ødegaard', 'Alexander Isak', 'Phil Foden', 'Marcus Rashford', 'Trent Alexander-Arnold', 'Bernardo Silva', 'William Saliba', 'James Maddison'] },
	{ title: 'F1 Drivers', category: 'Sports', items: ['Max Verstappen', 'Lewis Hamilton', 'Michael Schumacher', 'Ayrton Senna', 'Alain Prost', 'Sebastian Vettel', 'Fernando Alonso', 'Charles Leclerc', 'Lando Norris', 'Niki Lauda', 'Jim Clark', 'Jackie Stewart', 'Nigel Mansell', 'Kimi Räikkönen', 'Jenson Button', 'Oscar Piastri'] },

	// ── Food
	{ title: 'Fast Food Chains', category: 'Food', items: ['McDonald’s', 'In-N-Out', 'Chick-fil-A', 'Taco Bell', 'Wendy’s', 'Five Guys', 'Popeyes', 'Chipotle', 'Shake Shack', 'Whataburger', 'Raising Cane’s', 'KFC', 'Burger King', 'Subway', 'Domino’s', 'Culver’s', 'Sonic', 'Arby’s'] },
	{ title: 'Pizza Toppings', category: 'Food', items: ['Pepperoni', 'Sausage', 'Mushrooms', 'Extra Cheese', 'Bacon', 'Onions', 'Green Peppers', 'Black Olives', 'Pineapple', 'Ham', 'Jalapeños', 'Spinach', 'Anchovies', 'Chicken', 'Basil', 'Ricotta', 'Banana Peppers', 'Meatballs'] },
	{ title: 'Candy Bars', category: 'Food', items: ['Snickers', 'Reese’s', 'Twix', 'Kit Kat', 'Milky Way', '3 Musketeers', 'Butterfinger', 'Baby Ruth', 'Almond Joy', 'Mounds', 'Heath', 'Crunch', 'Hershey’s Bar', 'Payday', '100 Grand', 'Take 5', 'Whatchamacallit', 'Zero'] },
	{ title: 'Breakfast Cereals', category: 'Food', items: ['Frosted Flakes', 'Cinnamon Toast Crunch', 'Lucky Charms', 'Froot Loops', 'Cheerios', 'Honey Nut Cheerios', 'Cocoa Puffs', 'Reese’s Puffs', 'Raisin Bran', 'Rice Krispies', 'Corn Pops', 'Apple Jacks', 'Trix', 'Cap’n Crunch', 'Golden Grahams', 'Life', 'Special K', 'Honeycomb'] },
	{ title: 'Snack Chips', category: 'Food', items: ['Doritos Nacho Cheese', 'Cool Ranch Doritos', 'Lay’s Classic', 'Ruffles', 'Cheetos', 'Flamin’ Hot Cheetos', 'Fritos', 'Pringles', 'Sun Chips', 'Tostitos', 'Kettle Chips', 'Salt & Vinegar Lay’s', 'Funyuns', 'Takis', 'Combos', 'Bugles', 'Popchips', 'Cheez-Its'] },
	{ title: 'Sodas', category: 'Food', items: ['Coca-Cola', 'Pepsi', 'Dr Pepper', 'Sprite', 'Mountain Dew', 'Root Beer', 'Fanta Orange', '7 Up', 'Cherry Coke', 'Diet Coke', 'Canada Dry', 'A&W', 'Sunkist', 'Barq’s', 'Squirt', 'Big Red', 'Cheerwine', 'Crush Grape'] },

	// ── Music
	{ title: 'Rap GOATs', category: 'Music', items: ['Tupac', 'The Notorious B.I.G.', 'Jay-Z', 'Nas', 'Eminem', 'Kendrick Lamar', 'Andre 3000', 'Rakim', 'Lil Wayne', 'Kanye West', 'Drake', 'Snoop Dogg', 'Dr. Dre', 'J. Cole', 'Ice Cube', 'Method Man', 'Ghostface Killah', 'DMX', 'Missy Elliott', 'Lauryn Hill'] },
	{ title: 'Pop Stars', category: 'Music', items: ['Michael Jackson', 'Madonna', 'Beyoncé', 'Taylor Swift', 'Prince', 'Whitney Houston', 'Mariah Carey', 'Rihanna', 'Ariana Grande', 'Lady Gaga', 'Justin Timberlake', 'Britney Spears', 'Bruno Mars', 'Adele', 'Billie Eilish', 'The Weeknd', 'Dua Lipa', 'Usher'] },
	{ title: 'Rock Bands', category: 'Music', items: ['The Beatles', 'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones', 'Queen', 'Nirvana', 'Radiohead', 'AC/DC', 'Metallica', 'The Who', 'U2', 'Foo Fighters', 'Pearl Jam', 'Red Hot Chili Peppers', 'The Clash', 'Black Sabbath', 'Guns N’ Roses', 'The Doors'] },
	{ title: 'Country Artists', category: 'Music', items: ['Johnny Cash', 'Dolly Parton', 'Willie Nelson', 'George Strait', 'Garth Brooks', 'Hank Williams', 'Merle Haggard', 'Loretta Lynn', 'Shania Twain', 'Alan Jackson', 'Chris Stapleton', 'Miranda Lambert', 'Luke Combs', 'Tim McGraw', 'Reba McEntire', 'Waylon Jennings', 'Zach Bryan', 'Kacey Musgraves'] },
	{ title: 'Hip-Hop Albums', category: 'Music', items: ['Illmatic', 'The Chronic', 'Ready to Die', 'To Pimp a Butterfly', 'The Blueprint', 'good kid, m.A.A.d city', 'Enter the Wu-Tang', 'Aquemini', 'The Marshall Mathers LP', 'All Eyez on Me', 'My Beautiful Dark Twisted Fantasy', 'Paid in Full', 'Reasonable Doubt', 'The Miseducation of Lauryn Hill', 'Straight Outta Compton', 'Late Registration'] },

	// ── Video Games
	{ title: 'Pokémon (Gen 1)', category: 'Video Games', items: ['Charizard', 'Blastoise', 'Venusaur', 'Pikachu', 'Mewtwo', 'Mew', 'Gengar', 'Snorlax', 'Dragonite', 'Gyarados', 'Alakazam', 'Machamp', 'Lapras', 'Eevee', 'Jolteon', 'Vaporeon', 'Arcanine', 'Zapdos', 'Articuno', 'Moltres'] },
	{ title: 'Video Game Heroes', category: 'Video Games', items: ['Mario', 'Link', 'Master Chief', 'Kratos', 'Lara Croft', 'Samus Aran', 'Sonic', 'Cloud Strife', 'Geralt of Rivia', 'Solid Snake', 'Pac-Man', 'Donkey Kong', 'Steve (Minecraft)', 'Kirby', 'Ryu', 'Aloy', 'Nathan Drake', 'Mega Man'] },
	{ title: 'Nintendo Franchises', category: 'Video Games', items: ['Super Mario', 'The Legend of Zelda', 'Pokémon', 'Metroid', 'Donkey Kong', 'Kirby', 'Star Fox', 'Fire Emblem', 'Animal Crossing', 'Splatoon', 'Super Smash Bros.', 'Mario Kart', 'Pikmin', 'Xenoblade', 'Punch-Out!!', 'Earthbound'] },
	{ title: 'Fighting Game Characters', category: 'Video Games', items: ['Ryu', 'Ken', 'Chun-Li', 'Akuma', 'M. Bison', 'Scorpion', 'Sub-Zero', 'Raiden', 'Liu Kang', 'Jin Kazama', 'Heihachi', 'Kazuya', 'Terry Bogard', 'Sol Badguy', 'Ganondorf', 'Samus', 'Fox McCloud', 'Captain Falcon'] },
	{ title: 'Best-Selling Games', category: 'Video Games', items: ['Minecraft', 'Grand Theft Auto V', 'Tetris', 'Wii Sports', 'PUBG', 'Super Mario Bros.', 'Red Dead Redemption 2', 'The Witcher 3', 'Skyrim', 'Terraria', 'Animal Crossing: New Horizons', 'Mario Kart 8', 'Overwatch', 'Elden Ring', 'The Last of Us', 'Breath of the Wild'] },
	{ title: 'Minecraft Mobs', category: 'Video Games', items: ['Creeper', 'Enderman', 'Zombie', 'Skeleton', 'Spider', 'Villager', 'Iron Golem', 'Wither', 'Ender Dragon', 'Blaze', 'Ghast', 'Slime', 'Piglin', 'Axolotl', 'Allay', 'Warden', 'Sheep', 'Wolf'] },

	// ── Celebrities
	{ title: 'Hollywood A-Listers', category: 'Celebrities', items: ['Denzel Washington', 'Meryl Streep', 'Tom Hanks', 'Leonardo DiCaprio', 'Viola Davis', 'Robert De Niro', 'Cate Blanchett', 'Brad Pitt', 'Margot Robbie', 'Al Pacino', 'Zendaya', 'Ryan Gosling', 'Emma Stone', 'Will Smith', 'Scarlett Johansson', 'Keanu Reeves', 'Timothée Chalamet', 'Florence Pugh'] },
	{ title: 'Stand-Up Comedians', category: 'Celebrities', items: ['George Carlin', 'Richard Pryor', 'Dave Chappelle', 'Eddie Murphy', 'Chris Rock', 'Jerry Seinfeld', 'Bill Burr', 'Ali Wong', 'John Mulaney', 'Robin Williams', 'Joan Rivers', 'Kevin Hart', 'Bill Hicks', 'Mitch Hedberg', 'Tig Notaro', 'Nate Bargatze', 'Norm Macdonald', 'Wanda Sykes'] },
	{ title: 'Late Night Hosts', category: 'Celebrities', items: ['Johnny Carson', 'David Letterman', 'Conan O’Brien', 'Jon Stewart', 'Stephen Colbert', 'Jimmy Fallon', 'Jimmy Kimmel', 'Craig Ferguson', 'Seth Meyers', 'John Oliver', 'Trevor Noah', 'James Corden', 'Arsenio Hall', 'Jay Leno', 'Chelsea Handler', 'Desus Nice'] },
	{ title: 'Streamers & YouTubers', category: 'Celebrities', items: ['MrBeast', 'PewDiePie', 'Markiplier', 'Ninja', 'Pokimane', 'xQc', 'Kai Cenat', 'IShowSpeed', 'Dream', 'Jacksepticeye', 'Valkyrae', 'Shroud', 'Ludwig', 'Sykkuno', 'DanTDM', 'Casey Neistat', 'Emma Chamberlain', 'Marques Brownlee'] },
	{ title: 'Athletes Turned Icons', category: 'Celebrities', items: ['Muhammad Ali', 'Michael Jordan', 'Serena Williams', 'Tiger Woods', 'LeBron James', 'Shaquille O’Neal', 'David Beckham', 'Dwayne Johnson', 'Tom Brady', 'Simone Biles', 'Usain Bolt', 'Conor McGregor', 'Ronda Rousey', 'Cristiano Ronaldo', 'Wayne Gretzky', 'Babe Ruth'] }
];
