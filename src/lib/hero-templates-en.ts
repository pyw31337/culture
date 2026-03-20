
import { HeroTemplate } from './hero-templates';

export const HERO_TEMPLATES_EN: typeof import('./hero-templates').HERO_TEMPLATES = {
    general: [
        { line1: "A special day,", line2Pre: "Where's your ", highlight: "Spotlight", suffix: " today?", keywords: [] },
        { line1: "In the daily routine,", line2Pre: "Looking for ", highlight: "fresh inspiration", suffix: "?", keywords: ["exhibition"], requiredGenres: ["exhibition"] },
        { line1: "Feeling uninspired?", line2Pre: "Time for an ", highlight: "exciting experience", suffix: "!", keywords: [] },
        { line1: "With someone special,", line2Pre: "Create ", highlight: "unforgettable memories", suffix: " together.", keywords: [] },
        { line1: "Need some me-time?", line2Pre: "Discover a ", highlight: "special moment", suffix: " just for you.", keywords: [] },
        { line1: "Itching to explore?", line2Pre: "An ", highlight: "unexpected discovery", suffix: " awaits.", keywords: [] },
        { line1: "End of a long day,", line2Pre: "How about a ", highlight: "little treat", suffix: " for yourself?", keywords: [] },
        { line1: "Heart-racing excitement,", line2Pre: "Don't miss the ", highlight: "hottest events", suffix: " right now.", keywords: [] },
        { line1: "Today's the day,", line2Pre: "Clear your mind and enjoy ", highlight: "total immersion", suffix: ".", keywords: [] },
        { line1: "When art calls,", line2Pre: "Let a ", highlight: "beautiful story", suffix: " fill your heart.", keywords: [] },
        { line1: "Breathtaking performances,", line2Pre: "Live and vibrant, ", highlight: "passionate stages", suffix: " invite you.", keywords: [] },
        { line1: "An ordinary weekend,", line2Pre: "Turn it into a ", highlight: "movie-worthy day", suffix: " to remember.", keywords: [] },
        { line1: "Feeling stuck?", line2Pre: "A refreshing ", highlight: "spectacular show", suffix: " is just what you need.", keywords: [] },
        { line1: "Better than coffee,", line2Pre: "A lingering aftertaste of ", highlight: "artistic bliss", suffix: " — how about it?", keywords: [] },
        { line1: "Too nice to stay home,", line2Pre: "Your ", highlight: "cultural getaway", suffix: " starts right here.", keywords: [] },
        { line1: "Feed your soul,", line2Pre: "The ", highlight: "missing piece", suffix: " of your day awaits.", keywords: [] },
        { line1: "Same old routine?", line2Pre: "Let us add a ", highlight: "special soundtrack", suffix: " to your life.", keywords: [] },
        { line1: "Nothing to do?", line2Pre: "Join me on a ", highlight: "cultural adventure", suffix: "!", keywords: [] },
        { line1: "Haven't seen it yet?", line2Pre: "Everyone's talking about ", highlight: "this trending event", suffix: "!", keywords: [] },
        { line1: "How are you feeling?", line2Pre: "We'll find the perfect ", highlight: "mood-matching show", suffix: " for you.", keywords: [] },
        { line1: "A feast for the senses,", line2Pre: "An ", highlight: "electrifying experience", suffix: " awaits you.", keywords: [] },
        { line1: "Put your phone down,", line2Pre: "Feel the ", highlight: "live emotions", suffix: " unfolding before your eyes.", keywords: [] }
    ],
    keyword: [
        { line1: "It's finally here,", line2Pre: "The ", highlight: "{keyword}", suffix: " event just opened!", keywords: ["{keyword}"] },
        { line1: "The hottest right now,", line2Pre: "", highlight: "{keyword}", suffix: " — have you heard?", keywords: ["{keyword}"] },
        { line1: "Perfectly curated,", line2Pre: "A ", highlight: "{keyword}", suffix: " collection just for you.", keywords: ["{keyword}"] },
        { line1: "Perfect time to book,", line2Pre: "", highlight: "{keyword}", suffix: " events you'll love.", keywords: ["{keyword}"] },
        { line1: "Don't wait too long!", line2Pre: "", highlight: "{keyword}", suffix: " — the most popular picks.", keywords: ["{keyword}"] },
        { line1: "Looking for something?", line2Pre: "All ", highlight: "{keyword}", suffix: " info gathered here.", keywords: ["{keyword}"] },
        { line1: "Fan alert!!", line2Pre: "Nothing beats seeing ", highlight: "{keyword}", suffix: " live!", keywords: ["{keyword}"] },
        { line1: "Are you a fan?", line2Pre: "Special picks for ", highlight: "{keyword}", suffix: " enthusiasts.", keywords: ["{keyword}"] },
        { line1: "Set your alarms!!", line2Pre: "Fresh ", highlight: "{keyword}", suffix: " tickets just dropped!", keywords: ["{keyword}"] }
    ],
    weather: {
        rain: [
            { line1: "Rainy day ahead,", line2Pre: "How about a cozy ", highlight: "indoor exhibition", suffix: "?", keywords: [] },
            { line1: "Got your umbrella?", line2Pre: "Rainy days make ", highlight: "indoor dates", suffix: " even better.", keywords: [] },
            { line1: "Gloomy weather?", line2Pre: "Lift your spirits with an ", highlight: "exciting show", suffix: "!", keywords: [] },
            { line1: "With the sound of rain,", line2Pre: "Recharge your ", highlight: "emotional battery", suffix: ".", keywords: [] },
            { line1: "Dreary weather outside,", line2Pre: "Find your ", highlight: "energy boost", suffix: " at a live venue.", keywords: [] },
            { line1: "Rainy vibes,", line2Pre: "Find a place where ", highlight: "music fills the air", suffix: ".", keywords: [] },
            { line1: "Forget the dampness,", line2Pre: "Enjoy a refreshing ", highlight: "venue outing", suffix: "!", keywords: [] }
        ],
        snow: [
            { line1: "Snow is falling,", line2Pre: "Warm up at a cozy ", highlight: "performance hall", suffix: ".", keywords: [] },
            { line1: "A white world today,", line2Pre: "Find some ", highlight: "warm emotions", suffix: " inside.", keywords: [] },
            { line1: "Chilly winter days,", line2Pre: "Warm your heart with ", highlight: "romantic content", suffix: ".", keywords: [] },
            { line1: "Snowy day romance,", line2Pre: "Create ", highlight: "beautiful memories", suffix: " like in a movie.", keywords: [] },
            { line1: "First snow excitement,", line2Pre: "A ", highlight: "pure white stage", suffix: " awaits you.", keywords: [] },
            { line1: "Watch your step in the snow!", line2Pre: "But don't miss ", highlight: "this must-see event", suffix: "!", keywords: [] }
        ],
        clear: [
            { line1: "Beautiful day outside,", line2Pre: "Perfect for ", highlight: "a cultural stroll", suffix: ".", keywords: [] },
            { line1: "Under clear skies,", line2Pre: "Head out for a ", highlight: "venue adventure", suffix: "!", keywords: [] },
            { line1: "On a day like this,", line2Pre: "How about a refreshing ", highlight: "venue date", suffix: "?", keywords: [] },
            { line1: "Sunny and bright,", line2Pre: "If you're craving an escape, try a ", highlight: "cultural retreat", suffix: ".", keywords: [] },
            { line1: "A nice breeze blowing,", line2Pre: "Plan a ", highlight: "lovely date", suffix: " with someone special.", keywords: [] },
            { line1: "What a gorgeous sky,", line2Pre: "A perfect day to make ", highlight: "beautiful memories", suffix: ".", keywords: [] },
            { line1: "Sunshine calling!!", line2Pre: "As essential as vitamin D — your dose of ", highlight: "cultural energy", suffix: "!", keywords: [] }
        ]
    },
    time: {
        morning: [
            { line1: "Fresh morning,", line2Pre: "Start your day with ", highlight: "energizing content", suffix: ".", keywords: [] },
            { line1: "Good morning!!", line2Pre: "How about a ", highlight: "relaxing exhibition", suffix: " with your coffee?", keywords: [] },
            { line1: "Fighting today!!", line2Pre: "A ", highlight: "hopeful performance", suffix: " is waiting to inspire you.", keywords: [] },
            { line1: "Morning calm,", line2Pre: "A light, ", highlight: "easy-going show", suffix: " to enjoy.", keywords: [] },
            { line1: "A new morning,", line2Pre: "Wake up your senses with ", highlight: "beautiful melodies", suffix: ".", keywords: [] }
        ],
        afternoon: [
            { line1: "Lazy afternoon,", line2Pre: "Need a wake-up? Try a ", highlight: "thrilling activity", suffix: "!", keywords: [] },
            { line1: "Had a good lunch?", line2Pre: "Walk it off with a ", highlight: "light cultural stroll", suffix: ".", keywords: [] },
            { line1: "3 PM break time,", line2Pre: "A ", highlight: "sweet performance", suffix: " is ready for you.", keywords: [] },
            { line1: "Spice up your afternoon,", line2Pre: "Feast your eyes on a ", highlight: "stunning exhibition", suffix: ".", keywords: [] },
            { line1: "Sunny afternoon,", line2Pre: "Like reading by the window — a ", highlight: "quiet theater piece", suffix: " perhaps?", keywords: [] }
        ],
        evening: [
            { line1: "Great work today,", line2Pre: "Unwind after work with ", highlight: "a moment of comfort", suffix: ".", keywords: [] },
            { line1: "Ready to leave work?", line2Pre: "Rush to catch an ", highlight: "evening show", suffix: " you'll love.", keywords: [] },
            { line1: "Wrapping up your day,", line2Pre: "Fill your evening with ", highlight: "rich cultural moments", suffix: ".", keywords: [] },
            { line1: "As darkness falls,", line2Pre: "Brighter than city lights — the ", highlight: "glow of the stage", suffix: ".", keywords: [] },
            { line1: "Evenings with purpose,", line2Pre: "Make your night special with a ", highlight: "perfect pick", suffix: ".", keywords: [] }
        ],
        night: [
            { line1: "Quiet night,", line2Pre: "Before bed, fill your soul with ", highlight: "soothing classics", suffix: ".", keywords: [] },
            { line1: "Can't sleep?", line2Pre: "A ", highlight: "dreamy performance", suffix: " will keep you company.", keywords: [] },
            { line1: "Deep into the night,", line2Pre: "Pair with a glass of wine — a ", highlight: "moody show", suffix: " awaits.", keywords: [] },
            { line1: "Beautiful night air,", line2Pre: "Step into the ", highlight: "world of art", suffix: ".", keywords: [] },
            { line1: "Tonight's star,", line2Pre: "Even in your dreams — ", highlight: "fantastic content", suffix: " you won't forget.", keywords: [] }
        ],
        friday: [
            { line1: "Exciting Friday,", line2Pre: "You've earned it — time for ", highlight: "some healing", suffix: ".", keywords: [] },
            { line1: "Weekend kickoff!!", line2Pre: "Plan a ", highlight: "romantic date", suffix: " with someone you love.", keywords: [] },
            { line1: "TGIF!!!", line2Pre: "Blow off steam at a ", highlight: "passionate show", suffix: "!", keywords: [] },
            { line1: "Weekend around the corner,", line2Pre: "Prepare your ", highlight: "perfect culture plan", suffix: ".", keywords: [] },
            { line1: "Ready to clock out?", line2Pre: "Head straight to a ", highlight: "perfect Friday night", suffix: "!", keywords: [] }
        ],
        weekend: [
            { line1: "Happy weekend,", line2Pre: "Sleep in and enjoy a ", highlight: "leisurely show", suffix: "!", keywords: [] },
            { line1: "Weekend plans?", line2Pre: "Check out the ", highlight: "popular festivals", suffix: " for the family.", keywords: [] },
            { line1: "Finally weekend!!!",  line2Pre: "Time to tick off your ", highlight: "bucket list events", suffix: ".", keywords: [] },
            { line1: "Saturday night fever,", line2Pre: "Turn up the heat with a ", highlight: "late-night festival", suffix: "!", keywords: [] },
            { line1: "Sunday afternoon,", line2Pre: "Wind down before the week with a ", highlight: "calming exhibition", suffix: ".", keywords: [] }
        ]
    },
    season: {
        spring: [
            { line1: "Spring breeze blowing,", line2Pre: "More exciting than flowers — ", highlight: "spring performances", suffix: " await.", keywords: [] },
            { line1: "Warm spring day,", line2Pre: "Thaw your frozen senses with ", highlight: "soft exhibitions", suffix: ".", keywords: [] },
            { line1: "Cherry blossoms may be gone,", line2Pre: "But our spring has ", highlight: "just begun", suffix: "!", keywords: [] },
            { line1: "Feel like spring?", line2Pre: "Content full of ", highlight: "heart-fluttering joy", suffix: " — how about it?", keywords: [] },
            { line1: "Fresh spring energy,", line2Pre: "A ", highlight: "hopeful stage", suffix: " cheering you on.", keywords: [] }
        ],
        summer: [
            { line1: "Hot summer,", line2Pre: "Cool off with a ", highlight: "thrilling festival", suffix: "!", keywords: [] },
            { line1: "Long summer nights,", line2Pre: "Too good to sleep — enjoy ", highlight: "late-night content", suffix: "!", keywords: [] },
            { line1: "Summer vacation plans?", line2Pre: "If you can't travel far, try ", highlight: "urban escapes", suffix: "!", keywords: [] },
            { line1: "Like an iced coffee,", line2Pre: "Refreshingly cool — a ", highlight: "chill performance", suffix: " awaits.", keywords: [] },
            { line1: "Under the blazing sun,", line2Pre: "Even hotter — a ", highlight: "fiery stage", suffix: " invites you.", keywords: [] }
        ],
        autumn: [
            { line1: "Reading season — autumn,", line2Pre: "Deeper than any book — ", highlight: "masterpiece shows", suffix: ".", keywords: [] },
            { line1: "Cool autumn breeze,", line2Pre: "Comfort your wistful heart with ", highlight: "soulful music", suffix: ".", keywords: [] },
            { line1: "Feeling the fall vibes,", line2Pre: "When you need ", highlight: "warm comfort", suffix: " on lonely days.", keywords: [] },
            { line1: "Redder than autumn leaves,", line2Pre: "The artists' ", highlight: "fiery passion", suffix: " awaits.", keywords: [] },
            { line1: "Autumn night romance,", line2Pre: "Better than rustling leaves — ", highlight: "beautiful melodies", suffix: " to get lost in.", keywords: [] }
        ],
        winter: [
            { line1: "Cold winter days,", line2Pre: "Warm your heart with ", highlight: "cozy performances", suffix: ".", keywords: [] },
            { line1: "Wrapping up the year,", line2Pre: "A ", highlight: "special gift", suffix: " of time with loved ones.", keywords: [] },
            { line1: "Frosty winter,", line2Pre: "Melt your frozen body and soul with ", highlight: "touching shows", suffix: ".", keywords: [] },
            { line1: "Too cold to go out?", line2Pre: "Missing this event would be ", highlight: "even worse", suffix: "!", keywords: [] },
            { line1: "Like winter stars,", line2Pre: "A memory that will ", highlight: "sparkle forever", suffix: " in your heart.", keywords: [] },
            { line1: "Warmer than hot chocolate,", line2Pre: "Freshly served ", highlight: "new releases", suffix: "!", keywords: [] }
        ]
    },
    holiday: {
        newYear: [
            { line1: "New beginnings in January,", line2Pre: "Start the year with ", highlight: "cultural joy", suffix: "!", keywords: [] },
            { line1: "Happy New Year!!", line2Pre: "Make your resolution stick — plan ", highlight: "your first outing", suffix: "!", keywords: [] },
            { line1: "Best wishes!!", line2Pre: "A ", highlight: "lucky performance", suffix: " to brighten your year.", keywords: [] },
            { line1: "Seen the sunrise?", line2Pre: "Feel the ", highlight: "overwhelming emotions", suffix: " of a new dawn.", keywords: [] },
            { line1: "This year's bucket list,", line2Pre: "Start today — ", highlight: "Day 1 begins now", suffix: "!", keywords: [] }
        ],
        seollal: [
            { line1: "Happy Lunar New Year!!", line2Pre: "Celebrate with family through ", highlight: "festive content", suffix: ".", keywords: [] },
            { line1: "Joyful Seollal holiday,", line2Pre: "Make ", highlight: "special memories", suffix: " with your loved ones.", keywords: [] },
            { line1: "Holiday festivities,", line2Pre: "A ", highlight: "lively stage", suffix: " the whole family can enjoy.", keywords: [] },
            { line1: "Beat the holiday boredom!!", line2Pre: "After the feast, try a ", highlight: "cultural outing", suffix: "!", keywords: [] },
            { line1: "Lunar New Year fun,", line2Pre: "A ", highlight: "cultural celebration", suffix: " for the whole family.", keywords: [] }
        ],
        valentine: [
            { line1: "Sweet Valentine's Day,", line2Pre: "Sweeter than chocolate — a ", highlight: "content date", suffix: " for your love.", keywords: [] },
            { line1: "Heart-fluttering today,", line2Pre: "For that special someone — ", highlight: "a romantic time", suffix: ".", keywords: [] },
            { line1: "Confession D-Day,", line2Pre: "100% success rate venue — ", highlight: "atmosphere king", suffix: "!", keywords: [] },
            { line1: "Solo? That's fine!!", line2Pre: "Treat yourself to a ", highlight: "self-love gift", suffix: " today.", keywords: [] },
            { line1: "Melting like chocolate,", line2Pre: "Sweet melodies of a ", highlight: "love song", suffix: " — give it a listen.", keywords: [] }
        ],
        samil: [
            { line1: "Independence Day!!", line2Pre: "Reflect on history at ", highlight: "heritage exhibits", suffix: ".", keywords: [] },
            { line1: "A meaningful holiday,", line2Pre: "Enjoy a ", highlight: "cultural break", suffix: " with gratitude.", keywords: [] },
            { line1: "Echoes of that day,", line2Pre: "Discover ", highlight: "historic stories", suffix: " to remember.", keywords: [] },
            { line1: "Love for our nation,", line2Pre: "Spend a ", highlight: "meaningful day", suffix: " honoring history.", keywords: [] },
            { line1: "With the start of spring,", line2Pre: "Art that celebrates ", highlight: "freedom and peace", suffix: ".", keywords: [] }
        ],
        children: [
            { line1: "Happy Children's Day!!", line2Pre: "Fun-filled ", highlight: "kids' content", suffix: " is here!", keywords: [] },
            { line1: "We love you, kids!!",  line2Pre: "A ", highlight: "family show", suffix: " everyone will enjoy.", keywords: [] },
            { line1: "Dream big!!",  line2Pre: "Spark imagination with ", highlight: "creative exhibits", suffix: ".", keywords: [] },
            { line1: "Got the perfect gift?", line2Pre: "Better than toys — ", highlight: "precious memories", suffix: " to treasure.", keywords: [] },
            { line1: "All kids are stars!!",  line2Pre: "Today, be the hero — ", highlight: "let's have fun", suffix: "!", keywords: [] }
        ],
        chuseok: [
            { line1: "Happy Chuseok!!",  line2Pre: "Full as the harvest moon — ", highlight: "touching performances", suffix: " await.", keywords: [] },
            { line1: "Bountiful Chuseok holiday,", line2Pre: "A ", highlight: "grand musical", suffix: " the whole family will love.", keywords: [] },
            { line1: "Heading home?", line2Pre: "Beat the travel boredom with ", highlight: "fun reads", suffix: "!", keywords: [] },
            { line1: "After the feast,", line2Pre: "Blend tradition and modern in ", highlight: "fusion performances", suffix: "!", keywords: [] },
            { line1: "Wish upon the moon,", line2Pre: "May your wishes come true — ", highlight: "a magical moment", suffix: ".", keywords: [] }
        ],
        halloween: [
            { line1: "Trick or Treat!!", line2Pre: "On Halloween night, try a ", highlight: "spine-chilling experience", suffix: "!", keywords: [] },
            { line1: "Spooky night,", line2Pre: "Break the routine with a ", highlight: "party-like event", suffix: "!", keywords: [] },
            { line1: "Costume ready?", line2Pre: "Stand out at the ", highlight: "Halloween festival", suffix: "!", keywords: [] },
            { line1: "Spooky but fun,", line2Pre: "Meet some ", highlight: "cute ghosts", suffix: " kids will love.", keywords: [] },
            { line1: "Tonight's star,", line2Pre: "Not a witch or vampire — it's ", highlight: "you", suffix: "!", keywords: [] }
        ],
        christmas: [
            { line1: "Merry Christmas!!",  line2Pre: "Santa's gift — a ", highlight: "spectacular show", suffix: " you can't miss.", keywords: [] },
            { line1: "Romantic Christmas,", line2Pre: "Create ", highlight: "magical moments", suffix: " with your loved one.", keywords: [] },
            { line1: "Happy Holidays,", line2Pre: "Brighter than the tree — ", highlight: "your smile", suffix: " is all we wish for.", keywords: [] },
            { line1: "White Christmas?", line2Pre: "Snow or not, there's ", highlight: "snowflake-like emotions", suffix: " waiting.", keywords: [] },
            { line1: "Jingle bells ring,", line2Pre: "Spreading peace and love — a ", highlight: "warm concert", suffix: " invites you.", keywords: [] }
        ],
        yearEnd: [
            { line1: "Goodbye 2025,", line2Pre: "Close the year with ", highlight: "beautiful melodies", suffix: ".", keywords: [] },
            { line1: "Well done this year,", line2Pre: "Reward yourself with ", highlight: "the best shows", suffix: ".", keywords: [] },
            { line1: "Countdown time!!",  line2Pre: "Ring in the new year with ", highlight: "exciting moments", suffix: "!", keywords: [] },
            { line1: "Year-end gathering?", line2Pre: "Skip the usual — try a ", highlight: "classy cultural outing", suffix: "!", keywords: [] },
            { line1: "Adieu 2025,", line2Pre: "Shake off regrets and sing ", highlight: "new hope", suffix: "!", keywords: [] }
        ]
    },
    genre: {
        volleyball: [
            { line1: "How about a volleyball game?", line2Pre: "Smash away stress with a ", highlight: "live volleyball match", suffix: "!", keywords: [] },
            { line1: "Heart-pounding rallies,", line2Pre: "Feel the heat of the court at the ", highlight: "volleyball arena", suffix: ".", keywords: [] },
            { line1: "Powerful spikes!!",  line2Pre: "Witness the spirit of athletes in the ", highlight: "world of competition", suffix: ".", keywords: [] },
            { line1: "See the stars play live!", line2Pre: "Way more vivid than TV — discover ", highlight: "the magic of live sports", suffix: ".", keywords: [] },
            { line1: "Amazing blocks!", line2Pre: "Edge-of-your-seat ", highlight: "epic matches", suffix: " are unfolding.", keywords: [] }
        ],
        basketball: [
            { line1: "Buzzer-beater thrills!!", line2Pre: "A split-second showdown — enjoy ", highlight: "live basketball", suffix: ".", keywords: [] },
            { line1: "Love Slam Dunk?", line2Pre: "Real-life ", highlight: "action-packed games", suffix: " await.", keywords: [] },
            { line1: "Dominate the court,", line2Pre: "Feel the passion at the ", highlight: "basketball arena", suffix: ".", keywords: [] },
            { line1: "Winter indoor sports,", line2Pre: "Even the cold can't stop the ", highlight: "roaring crowd", suffix: "!", keywords: [] },
            { line1: "Channel your inner MJ,", line2Pre: "See flashy moves and ", highlight: "amazing dunks", suffix: " up close!", keywords: [] }
        ],
        soccer: [
            { line1: "GOAL!!! The crowd roars,", line2Pre: "On the green pitch — ", highlight: "a soccer match", suffix: " to cheer for.", keywords: [] },
            { line1: "Soccer day today,", line2Pre: "Grab some snacks and head to the ", highlight: "stadium", suffix: "!", keywords: [] },
            { line1: "Be the Red Devil,", line2Pre: "Join the heart-pounding ", highlight: "cheering squad", suffix: "!", keywords: [] },
            { line1: "World-class plays,", line2Pre: "Cheer on the ", highlight: "players' passion", suffix: " on the field.", keywords: [] },
            { line1: "90 minutes of drama,", line2Pre: "Unpredictable — nothing beats ", highlight: "live soccer", suffix: ".", keywords: [] }
        ],
        baseball: [
            { line1: "Ready for the ballpark?", line2Pre: "Bottom of the 9th, 2 outs — ", highlight: "comeback drama", suffix: " awaits!", keywords: [] },
            { line1: "Fried chicken + Baseball!!", line2Pre: "Sing along with the crowd — the ", highlight: "cheering songs", suffix: " call you!", keywords: [] },
            { line1: "Home run, going going gone!!", line2Pre: "Blow off stress with a ", highlight: "satisfying homer", suffix: "!", keywords: [] },
            { line1: "Chase for the pennant,", line2Pre: "Every game counts — witness the ", highlight: "fierce competition", suffix: ".", keywords: [] },
            { line1: "It ain't over till it's over,", line2Pre: "Believe in a ", highlight: "miraculous victory", suffix: "!", keywords: [] }
        ],
        handball: [
            { line1: "Pure grit and passion,", line2Pre: "A small ball, big ", highlight: "fighting spirit", suffix: ".", keywords: [] },
            { line1: "Speed meets power,", line2Pre: "Indoor ", highlight: "dynamic showdowns", suffix: " — handball!", keywords: [] },
            { line1: "H-League is on!!",  line2Pre: "Feel the players' breath at the ", highlight: "live arena", suffix: ".", keywords: [] },
            { line1: "Throw, block, run!!",  line2Pre: "Non-stop ", highlight: "action-packed games", suffix: ".", keywords: [] },
            { line1: "Hidden gem sport!!", line2Pre: "Once you try it, you'll love the ", highlight: "charm of handball", suffix: ".", keywords: [] }
        ],
        musical: [
            { line1: "Today, you're the star,", line2Pre: "Under dazzling lights — a ", highlight: "musical for you", suffix: "!", keywords: [] },
            { line1: "A feast for eyes and ears,", line2Pre: "Fill your heart with a ", highlight: "masterpiece musical", suffix: ".", keywords: [] },
            { line1: "Broadway has nothing on us!!", line2Pre: "A ", highlight: "world-class stage", suffix: " right here.", keywords: [] },
            { line1: "Breathtaking numbers,", line2Pre: "Be blown away by ", highlight: "incredible vocals", suffix: ".", keywords: [] },
            { line1: "Better than VIP seats,", line2Pre: "Introducing a ", highlight: "must-see new release", suffix: ".", keywords: [] }
        ],
        play: [
            { line1: "Theater vibes on,",  line2Pre: "Feel the actors' breath on a ", highlight: "theater stage", suffix: ".", keywords: [] },
            { line1: "Small but powerful happiness,", line2Pre: "Laughs and tears in a ", highlight: "heartfelt play", suffix: ".", keywords: [] },
            { line1: "Different from the screen,", line2Pre: "Up-close ", highlight: "authentic acting", suffix: " you won't forget.", keywords: [] },
            { line1: "Romance to thriller,", line2Pre: "Pick your taste — a ", highlight: "world of theater", suffix: ".", keywords: [] },
            { line1: "What to do today? Theater!", line2Pre: "Make ", highlight: "special memories", suffix: " with friends or your partner.", keywords: [] }
        ],
        classical: [
            { line1: "An elegant day,", line2Pre: "Calm your mind with ", highlight: "classical melodies", suffix: ".", keywords: [] },
            { line1: "Turn off your thoughts,", line2Pre: "Lose yourself in the orchestra's ", highlight: "grand resonance", suffix: ".", keywords: [] },
            { line1: "Melodies that touch the soul,", line2Pre: "Healing ", highlight: "music", suffix: " for the weary.", keywords: [] },
            { line1: "Grace of ballet,", line2Pre: "Every fingertip carries emotion — ", highlight: "beautiful movements", suffix: ".", keywords: [] },
            { line1: "Brunch concert?", line2Pre: "A leisurely morning — ", highlight: "coffee meets classical", suffix: ".", keywords: [] }
        ],
        concert: [
            { line1: "Ready to sing along?", line2Pre: "Blast away stress at a ", highlight: "wild concert", suffix: "!", keywords: [] },
            { line1: "Meeting your fave today,", line2Pre: "The moment you've dreamed of — pure ", highlight: "excitement", suffix: "!", keywords: [] },
            { line1: "Lost in music tonight,", line2Pre: "Live sound — a ", highlight: "thrilling performance", suffix: " awaits.", keywords: [] },
            { line1: "Scream your heart out!!",  line2Pre: "Everyone becomes one — a ", highlight: "cauldron of passion", suffix: "!", keywords: [] },
            { line1: "Soulful vocals live,", line2Pre: "Soothing ", highlight: "warm songs", suffix: " to heal your heart.", keywords: [] }
        ],
        exhibition: [
            { line1: "Need some quiet reflection?", line2Pre: "Enjoy at your own pace — a ", highlight: "gallery date", suffix: ".", keywords: [] },
            { line1: "Seeking new inspiration?", line2Pre: "Awaken your senses with a ", highlight: "special exhibition", suffix: ".", keywords: [] },
            { line1: "Photo-worthy spot alert!!",  line2Pre: "Every shot's a masterpiece — ", highlight: "photo zones galore", suffix: ".", keywords: [] },
            { line1: "Art meets technology,", line2Pre: "Immerse yourself in ", highlight: "media art", suffix: ".", keywords: [] },
            { line1: "With a docent guide,", line2Pre: "Art becomes more fun — a ", highlight: "friendly art journey", suffix: ".", keywords: [] }
        ],
        activity: [
            { line1: "Boredom? No thanks!!",  line2Pre: "Feel the rush of ", highlight: "thrilling activities", suffix: ".", keywords: [] },
            { line1: "Adrenaline rush!!",  line2Pre: "Blow off daily stress with ", highlight: "exciting challenges", suffix: "!", keywords: [] },
            { line1: "Unique date this weekend,", line2Pre: "Get closer while sweating — ", highlight: "couple activities", suffix: " recommended!", keywords: [] },
            { line1: "VR to indoor sports,", line2Pre: "Rain or shine — ", highlight: "indoor playground", suffix: " roundup.", keywords: [] },
            { line1: "Escape room time!!", line2Pre: "Full brain power — become the hero of an ", highlight: "escape game", suffix: "!", keywords: [] }
        ],
        class: [
            { line1: "Beginner to pro?", line2Pre: "Find ", highlight: "your new hobby", suffix: " today.", keywords: [] },
            { line1: "After-work goals,", line2Pre: "Energize your routine with a ", highlight: "one-day class", suffix: "!", keywords: [] },
            { line1: "Create your own scent,", line2Pre: "A one-of-a-kind ", highlight: "special gift", suffix: " made by you.", keywords: [] },
            { line1: "Cooking to drawing,", line2Pre: "Embrace the ", highlight: "joy of learning", suffix: ".", keywords: [] },
            { line1: "Baking master challenge!!", line2Pre: "Heal with sweet aromas at a ", highlight: "cooking class", suffix: ".", keywords: [] }
        ],
        movie: [
            { line1: "A cinematic day,", line2Pre: "With the smell of popcorn — a ", highlight: "screen journey", suffix: " awaits!", keywords: [] },
            { line1: "The people's choice,", line2Pre: "Check out the hottest ", highlight: "blockbuster", suffix: " right now.", keywords: [] },
            { line1: "An emotional epic,", line2Pre: "Grab your tissues — a ", highlight: "hit movie", suffix: " that'll move you.", keywords: [] },
            { line1: "Heart-pounding thriller,", line2Pre: "Twist after twist — a ", highlight: "mind-blowing story", suffix: ".", keywords: [] },
            { line1: "Sweet romance,", line2Pre: "Awaken your love cells with an ", highlight: "adorable film", suffix: ".", keywords: [] }
        ]
    },
    location_mode: [
        { line1: "What's around me?", line2Pre: "We'll find ", highlight: "nearby content", suffix: " for you.", keywords: [] },
        { line1: "Don't feel like traveling far?", line2Pre: "Enjoy ", highlight: "local culture", suffix: " in your neighborhood.", keywords: [] },
        { line1: "Map picks!!",  line2Pre: "Based on your location — ", highlight: "hot spots info", suffix: " gathered!", keywords: [] },
        { line1: "Ready to go right now,", line2Pre: "Check ", highlight: "real-time shows nearby", suffix: ".", keywords: [] },
        { line1: "Next to your favorite spot,", boldPrefix: "Local gems", line2Pre: " — discover a ", highlight: "hidden stage", suffix: "!", keywords: [] }
    ],
    search_mode: [
        { line1: "Looking for something?", line2Pre: "Search by ", highlight: "keyword", suffix: " to find the perfect match.", keywords: [] },
        { line1: "Taste-hunter mode,", line2Pre: "Browse ", highlight: "themed picks", suffix: " just for you.", keywords: [] },
        { line1: "Curiosity strikes!!", line2Pre: "From trending to ", highlight: "hidden gems", suffix: " — search it all.", keywords: [] },
        { line1: "Just say the name,", line2Pre: "Find your favorite ", highlight: "artist or show", suffix: ".", keywords: [] },
        { line1: "Not sure what to watch?", line2Pre: "Get inspired by ", highlight: "trending searches", suffix: "!", keywords: [] }
    ]
};
