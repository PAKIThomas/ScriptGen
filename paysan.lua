-- Script Paysan 1 à 200 pour MizanBot
-- Version avec départ sécurisé par le Havre-sac

MAX_PODS = 90
MIN_MONSTERS = 1
MAX_MONSTERS = 8
OPEN_BAGS = true

ELEMENTS_TO_GATHER = {134, 261, 260, 46, 47, 111, 44, 42, 39, 45, 43, 38, 84}

function updateElementsToGather()
    if type(job) == "table" and type(job.level) == "function" then
        local lvl = job:level(28)
        if lvl >= 200 then
            ELEMENTS_TO_GATHER = {134, 261, 260, 46, 47, 111, 44, 84}
        else
            ELEMENTS_TO_GATHER = {134, 261, 260, 46, 47, 111, 44, 42, 39, 45, 43, 38, 84}
        end
    end
end

function getAvailablePaths()
    local lvl = 1
    if type(job) == "table" and type(job.level) == "function" then
        lvl = job:level(28)
    end
    
    local paths = {1, 2, 3}
    if lvl >= 100 then
        table.insert(paths, 4)
    end
    table.insert(paths, 5)
    if lvl >= 160 then
        table.insert(paths, 6)
    end
    if lvl >= 180 then
        table.insert(paths, 9)
    end
    if lvl >= 200 then
        table.insert(paths, 8)
    end
    return paths
end

if not _G.cheminSequence then
    _G.cheminSequence = 1
end

function nextChemin()
    updateElementsToGather()
    local old = _G.cheminSequence
    local paths = getAvailablePaths()

    if #paths <= 1 then
        _G.cheminSequence = paths[1]
    else
        local possiblePaths = {}
        for _, p in ipairs(paths) do
            if p ~= old then
                table.insert(possiblePaths, p)
            end
        end

        local randIndex = math.random(1, #possiblePaths)
        _G.cheminSequence = possiblePaths[randIndex]
    end

    local currentLvl = (type(job) == "table" and type(job.level) == "function") and job:level(28) or "?"
    if type(printMessage) == "function" then
        printMessage("Passage du chemin " .. tostring(old) .. " vers " .. tostring(_G.cheminSequence) .. " (Aleatoire) (Paysan lvl " .. tostring(currentLvl) .. ")", "green")
    end
    return true
end

function move()
    if type(inventory) == "table" and type(inventory.openBags) == "function" then
        inventory:openBags()
    end
    updateElementsToGather()

    local chemin = _G.cheminSequence
    
    if chemin == 1 then
        return {
            { map = "havenbag", changeMap = "zaap:191105026", gather = true }, -- Utilise le havre-sac pour s'en extraire et viser le zaap
            { map = "191105026", changeMap = "goto:188746241",    gather = true },
            { map = "188746241", changeMap = "goto:188746753",    gather = true },
            { map = "188746753", changeMap = "goto:193332225",    gather = true },
            { map = "193332225", changeMap = "goto:193331713",    gather = true },
            { map = "193331713", changeMap = "goto:189795337",    gather = true },
            { map = "189795337", changeMap = "goto:189794825",    gather = true },
            { map = "189794825", changeMap = "goto:189794313",    gather = true },
            { map = "189794313", changeMap = "goto:189793801",    gather = true },
            { map = "189793801", changeMap = "goto:189793289",    gather = true },
            { map = "189793289", changeMap = "goto:189792777",    gather = true },
            { map = "189792777", changeMap = "goto:189792265",    gather = true },
            { map = "189792265", changeMap = "goto:189792264",    gather = true },
            { map = "189792264", changeMap = "goto:189792776",    gather = true },
            { map = "189792776", changeMap = "goto:189793288",    gather = true },
            { map = "189793288", changeMap = "goto:189793800",    gather = true },
            { map = "189793800", changeMap = "goto:189794312",    gather = true },
            { map = "189794312", changeMap = "goto:189794824",    gather = true },
            { map = "189794824", changeMap = "goto:189795336",    gather = true },
            { map = "189795336", changeMap = "goto:189795335",    gather = true },
            { map = "189795335", changeMap = "goto:189794823",    gather = true },
            { map = "189794823", changeMap = "goto:189794311",    gather = true },
            { map = "189794311", changeMap = "goto:189794310",    gather = true },
            { map = "189794310", changeMap = "goto:189793798",    gather = true },
            { map = "189793798", changeMap = "goto:189793799",    gather = true },
            { map = "189793799", changeMap = "goto:189793287",    gather = true },
            { map = "189793287", changeMap = "goto:189793286",    gather = true },
            { map = "189793286", changeMap = "goto:189792774",    gather = true },
            { map = "189792774", changeMap = "goto:189792775",    gather = true },
            { map = "189792775", changeMap = "goto:189792263",    gather = true },
            { map = "189792263", changeMap = "goto:189792262",    gather = true },
            { map = "189792262", changeMap = "goto:189792261",    gather = true },
            { map = "189792261", changeMap = "goto:189792773",    gather = true },
            { map = "189792773", changeMap = "goto:189793285",    gather = true },
            { map = "189793285", changeMap = "goto:189793797",    gather = true },
            { map = "189793797", changeMap = "goto:189794309",    gather = true },
            { map = "189794309", changeMap = "goto:189794308",    gather = true },
            { map = "189794308", changeMap = "goto:189793796",    gather = true },
            { map = "189793796", changeMap = "goto:189793284",    gather = true },
            { map = "189793284", changeMap = "goto:189792772",    gather = true },
            { map = "189792772", changeMap = "goto:189792260",    gather = true },
            { map = "189792260", changeMap = "goto:189792259",    gather = true },
            { map = "189792259", changeMap = "goto:189792771",    gather = true },
            { map = "189792771", changeMap = "goto:189793283",    gather = true },
            { map = "189793283", changeMap = "goto:189793795",    gather = true },
            { map = "189793795", changeMap = "goto:189793794",    gather = true },
            { map = "189793794", changeMap = "goto:189793282",    gather = true },
            { map = "189793282", changeMap = "goto:189792770",    gather = true },
            { map = "189792770", changeMap = "goto:189792258",    gather = true },
            { map = "189792258", changeMap = "goto:189792257",    gather = true },
            { map = "189792257", changeMap = "goto:189792256",    gather = true },
            { map = "189792256", changeMap = "goto:189792768",    gather = true },
            { map = "189792768", changeMap = "goto:189792769",    gather = true },
            { map = "189792769", changeMap = "goto:189793281",    gather = true },
            { map = "189793281", changeMap = "goto:189793793",    gather = true },
            { map = "189793793", custom = nextChemin, gather = true },
        }
    elseif chemin == 2 then
        return {
            { map = "havenbag", changeMap = "zaap:88082704", gather = true },
            { map = "88082704",  changeMap = "goto:88082192",    gather = true },
            { map = "88082192",  changeMap = "goto:88082193",    gather = true },
            { map = "88082193",  changeMap = "goto:88082705",    gather = true },
            { map = "88082705",  changeMap = "goto:88083217",    gather = true },
            { map = "88083217",  changeMap = "goto:88083216",    gather = true },
            { map = "88083216",  changeMap = "goto:88083215",    gather = true },
            { map = "88083215",  changeMap = "goto:88083727",    gather = true },
            { map = "88083727",  changeMap = "goto:88083728",    gather = true },
            { map = "88083728",  changeMap = "goto:88083729",    gather = true },
            { map = "88083729",  changeMap = "goto:88083730",    gather = true },
            { map = "88083730",  changeMap = "goto:88083731",    gather = true },
            { map = "88083731",  changeMap = "goto:88084243",    gather = true },
            { map = "88084243",  changeMap = "goto:88084242",    gather = true },
            { map = "88084242",  changeMap = "goto:88084754",    gather = true },
            { map = "88084754",  changeMap = "goto:88085266",    gather = true },
            { map = "88085266",  changeMap = "goto:88085778",    gather = true },
            { map = "88085778",  changeMap = "goto:88085777",    gather = true },
            { map = "88085777",  changeMap = "goto:88085265",    gather = true },
            { map = "88085265",  changeMap = "goto:88084753",    gather = true },
            { map = "88084753",  changeMap = "goto:88084241",    gather = true },
            { map = "88084241",  changeMap = "goto:88084240",    gather = true },
            { map = "88084240",  changeMap = "goto:88084752",    gather = true },
            { map = "88084752",  changeMap = "goto:88085264",    gather = true },
            { map = "88085264",  changeMap = "goto:88085263",    gather = true },
            { map = "88085263",  changeMap = "goto:88085262",    gather = true },
            { map = "88085262",  changeMap = "goto:88084750",    gather = true },
            { map = "88084750",  changeMap = "goto:88084751",    gather = true },
            { map = "88084751",  changeMap = "goto:88084239",    gather = true },
            { map = "88084239",  changeMap = "goto:88084238",    gather = true },
            { map = "88084238",  changeMap = "goto:88083726",    gather = true },
            { map = "88083726", custom = nextChemin, gather = true },
        }
    elseif chemin == 3 then
        return {
            { map = "havenbag", changeMap = "zaap:88212481", gather = true },
            { map = "88212481",  changeMap = "goto:88211969",    gather = true },
            { map = "88211969",  changeMap = "goto:88211968",    gather = true },
            { map = "88211968",  changeMap = "goto:88080384",    gather = true },
            { map = "88080384",  changeMap = "goto:88080896",    gather = true },
            { map = "88080896",  changeMap = "goto:88081153",    gather = true },
            { map = "88081153",  changeMap = "goto:88081665",    gather = true },
            { map = "88081665",  changeMap = "goto:88081408",    gather = true },
            { map = "88081408",  changeMap = "goto:88081409",    gather = true },
            { map = "88081409",  changeMap = "goto:88081921",    gather = true },
            { map = "88081921",  changeMap = "goto:88081922",    gather = true },
            { map = "88081922",  changeMap = "goto:88081410",    gather = true },
            { map = "88081410",  changeMap = "goto:88080898",    gather = true },
            { map = "88080898",  changeMap = "goto:88080897",    gather = true },
            { map = "88080897",  changeMap = "goto:88080385",    gather = true },
            { map = "88080385",  changeMap = "goto:88080386",    gather = true },
            { map = "88080386",  changeMap = "goto:88211970",    gather = true },
            { map = "88211970",  changeMap = "goto:88211971",    gather = true },
            { map = "88211971",  changeMap = "goto:88081411",    gather = true },
            { map = "88081411",  changeMap = "goto:88081923",    gather = true },
            { map = "88081923",  changeMap = "goto:88082435",    gather = true },
            { map = "88082435",  changeMap = "goto:88082436",    gather = true },
            { map = "88082436",  changeMap = "goto:88082437",    gather = true },
            { map = "88082437",  changeMap = "goto:88081925",    gather = true },
            { map = "88081925",  changeMap = "goto:88081924",    gather = true },
            { map = "88081924",  changeMap = "goto:88081412",    gather = true },
            { map = "88081412",  changeMap = "goto:88081413",    gather = true },
            { map = "88081413",  changeMap = "goto:88080901",    gather = true },
            { map = "88080901",  changeMap = "goto:88080389",    gather = true },
            { map = "88080389", custom = nextChemin, gather = true },
        }
    elseif chemin == 4 then
        return {
            { map = "havenbag", changeMap = "zaap:207619076", gather = true },
            { map = "207619076", changeMap = "goto:206307842",    gather = true },
            { map = "206307842", changeMap = "goto:206308356",    gather = true },
            { map = "206308356", changeMap = "goto:204998915",    gather = true },
            { map = "204998915", changeMap = "goto:204998914",    gather = true },
            { map = "204998914", changeMap = "goto:204998402",    gather = true },
            { map = "204998402", changeMap = "goto:204998403",    gather = true },
            { map = "204998403", changeMap = "goto:204997891",    gather = true },
            { map = "204997891", changeMap = "goto:204997890",    gather = true },
            { map = "204997890", changeMap = "goto:204997378",    gather = true },
            { map = "204997378", changeMap = "goto:204997377",    gather = true },
            { map = "204997377", changeMap = "goto:204997120",    gather = true },
            { map = "204997120", changeMap = "goto:204997121",    gather = true },
            { map = "204997121", custom = nextChemin,           gather = true },
        }
    elseif chemin == 5 then
        return {
            { map = "havenbag", changeMap = "zaap:142087694", gather = true },
            { map = "142087694", changeMap = "goto:142088206",    gather = true },
            { map = "142088206", changeMap = "goto:142088205",    gather = true },
            { map = "142088205", changeMap = "goto:142088204",    gather = true },
            { map = "142088204", changeMap = "goto:142087692",    gather = true },
            { map = "142087692", changeMap = "goto:142087691",    gather = true },
            { map = "142087691", changeMap = "goto:142087690",    gather = true },
            { map = "142087690", changeMap = "goto:142088202",    gather = true },
            { map = "142088202", changeMap = "goto:142088203",    gather = true },
            { map = "142088203", changeMap = "goto:142088715",    gather = true },
            { map = "142088715", changeMap = "goto:142088714",    gather = true },
            { map = "142088714", changeMap = "goto:142089226",    gather = true },
            { map = "142089226", changeMap = "goto:142089227",    gather = true },
            { map = "142089227", changeMap = "goto:142089739",    gather = true },
            { map = "142089739", changeMap = "goto:142090251",    gather = true },
            { map = "142090251", changeMap = "goto:142090763",    gather = true },
            { map = "142090763", changeMap = "goto:142090762",    gather = true },
            { map = "142090762", changeMap = "goto:142090250",    gather = true },
            { map = "142090250", changeMap = "goto:142089738",    gather = true },
            { map = "142089738", changeMap = "goto:142089737",    gather = true },
            { map = "142089737", changeMap = "goto:142089736",    gather = true },
            { map = "142089736", changeMap = "goto:142090248",    gather = true },
            { map = "142090248", changeMap = "goto:142090247",    gather = true },
            { map = "142090247", changeMap = "goto:142090246",    gather = true },
            { map = "142090246", changeMap = "goto:142089734",    gather = true },
            { map = "142089734", changeMap = "goto:142089222",    gather = true },
            { map = "142089222", changeMap = "goto:142089223",    gather = true },
            { map = "142089223", changeMap = "goto:142089224",    gather = true },
            { map = "142089224", changeMap = "goto:142089225",    gather = true },
            { map = "142089225", changeMap = "goto:142088713",    gather = true },
            { map = "142088713", changeMap = "goto:142088712",    gather = true },
            { map = "142088712", changeMap = "goto:142088711",    gather = true },
            { map = "142088711", changeMap = "goto:142088710",    gather = true },
            { map = "142088710", changeMap = "goto:142087173",    gather = true },
            { map = "142087173", changeMap = "goto:142087174",    gather = true },
            { map = "142087174", changeMap = "goto:142087686",    gather = true },
            { map = "142087686", changeMap = "goto:142088198",    gather = true },
            { map = "142088198", changeMap = "goto:142088199",    gather = true },
            { map = "142088199", changeMap = "goto:142088200",    gather = true },
            { map = "142088200", changeMap = "goto:142088201",    gather = true },
            { map = "142088201", changeMap = "goto:142087689",    gather = true },
            { map = "142087689", changeMap = "goto:142087688",    gather = true },
            { map = "142087688", changeMap = "goto:142087687",    gather = true },
            { map = "142087687", changeMap = "goto:142087175",    gather = true },
            { map = "142087175", changeMap = "goto:142087176",    gather = true },
            { map = "142087176", changeMap = "goto:142087177",    gather = true },
            { map = "142087177", changeMap = "goto:142087178",    gather = true },
            { map = "142087178", changeMap = "goto:142086666",    gather = true },
            { map = "142086666", changeMap = "goto:142086154",    gather = true },
            { map = "142086154", changeMap = "goto:142086155",    gather = true },
            { map = "142086155", changeMap = "goto:142086667",    gather = true },
            { map = "142086667", changeMap = "goto:142087179",    gather = true },
            { map = "142087179", changeMap = "goto:142087180",    gather = true },
            { map = "142087180", changeMap = "goto:142086668",    gather = true },
            { map = "142086668", changeMap = "goto:142086669",    gather = true },
            { map = "142086669", changeMap = "goto:142087181",    gather = true },
            { map = "142087181", custom = nextChemin,           gather = true },
        }
    elseif chemin == 6 then
        return {
            { map = "havenbag", changeMap = "zaap:154642", gather = true },
            { map = "154642",    changeMap = "goto:156684",    gather = true },
            { map = "156684",    changeMap = "goto:156683",    gather = true },
            { map = "156683",    changeMap = "goto:157195",    gather = true },
            { map = "157195",    changeMap = "goto:157194",    gather = true },
            { map = "157194",    changeMap = "goto:157193",    gather = true },
            { map = "157193",    changeMap = "goto:157704",    gather = true },
            { map = "157704",    changeMap = "goto:157703",    gather = true },
            { map = "157703",    changeMap = "goto:159236",    gather = true },
            { map = "159236",    changeMap = "goto:159235",    gather = true },
            { map = "159235",    changeMap = "goto:158723",    gather = true },
            { map = "158723", custom = nextChemin, gather = true },
        }
    elseif chemin == 7 then
        return {
            { map = "havenbag", changeMap = "zaap:126094107", gather = true },
            { map = "126094107", changeMap = "goto:126094619", gather = true },
            { map = "126094619", changeMap = "goto:126095131", gather = true },
            { map = "126095131", changeMap = "goto:126095130", gather = true },
            { map = "126095130", changeMap = "goto:126095129", gather = true },
            { map = "126095129", changeMap = "goto:126095128", gather = true },
            { map = "126095128", changeMap = "goto:126094616", gather = true },
            { map = "126094616", changeMap = "goto:126094104", gather = true },
            { map = "126094104", changeMap = "goto:126093592", gather = true },
            { map = "126093592", changeMap = "goto:126093593", gather = true },
            { map = "126093593", changeMap = "goto:126093081", gather = true },
            { map = "126093081", custom = nextChemin, gather = true },
        }
    elseif chemin == 8 then
        return {
            { map = "havenbag", changeMap = "zaap:54172969", gather = true },
            { map = "54172969",  changeMap = "goto:54176557",    gather = true },
            { map = "54176557",  changeMap = "goto:54176046",    gather = true },
            { map = "54176046",  changeMap = "goto:54175535",    gather = true },
            { map = "54175535",  changeMap = "goto:54175023",    gather = true },
            { map = "54175023",  changeMap = "goto:54174511",    gather = true },
            { map = "54174511",  changeMap = "goto:54174000",    gather = true },
            { map = "54174000",  changeMap = "goto:54173488",    gather = true },
            { map = "54173488",  changeMap = "goto:54172975",    gather = true },
            { map = "54172975",  changeMap = "goto:54172463",    gather = true },
            { map = "54172463",  changeMap = "goto:54171951",    gather = true },
            { map = "54171951",  changeMap = "goto:54169903",    gather = true },
            { map = "54169903",  changeMap = "goto:54169391",    gather = true },
            { map = "54169391",  changeMap = "goto:54169390",    gather = true },
            { map = "54169390",  changeMap = "goto:54169902",    gather = true },
            { map = "54169902",  changeMap = "goto:54170414",    gather = true },
            { map = "54170414",  changeMap = "goto:54170925",    gather = true },
            { map = "54170925",  changeMap = "goto:54170413",    gather = true },
            { map = "54170413",  changeMap = "goto:54169901",    gather = true },
            { map = "54169901",  changeMap = "goto:54169389",    gather = true },
            { map = "54169389",  changeMap = "goto:54168877",    gather = true },
            { map = "54168877",  changeMap = "goto:54169900",    gather = true },
            { map = "54169900",  changeMap = "goto:54170412",    gather = true },
            { map = "54170412",  changeMap = "goto:54169387",    gather = true },
            { map = "54169387",  changeMap = "goto:54168362",    gather = true },
            { map = "54168362",  changeMap = "goto:54168873",    gather = true },
            { map = "54168873",  changeMap = "goto:54168872",    gather = true },
            { map = "54168872",  changeMap = "goto:54168360",    gather = true },
            { map = "54168360",  changeMap = "goto:54167848",    gather = true },
            { map = "54167848",  changeMap = "goto:54167847",    gather = true },
            { map = "54167847",  changeMap = "goto:54168871",    gather = true },
            { map = "54168871",  changeMap = "goto:54168358",    gather = true },
            { map = "54168358",  changeMap = "goto:54168357",    gather = true },
            { map = "54168357",  changeMap = "goto:54168869",    gather = true },
            { map = "54168869",  changeMap = "goto:54168355",    gather = true },
            { map = "54168355",  changeMap = "goto:54169378",    gather = true },
            { map = "54169378",  changeMap = "goto:54169377",    gather = true },
            { map = "54169377",  changeMap = "goto:54169888",    gather = true },
            { map = "54169888", custom = nextChemin, gather = true },
        }
    elseif chemin == 9 then
        return {
            { map = "havenbag", changeMap = "zaap:156240386", gather = true },
            { map = "156240386", changeMap = "goto:126092566", gather = true },
            { map = "126092566", changeMap = "goto:126093078", gather = true },
            { map = "126093078", changeMap = "goto:126092567", gather = true },
            { map = "126092567", changeMap = "goto:126093080", gather = true },
            { map = "126093080", changeMap = "goto:126092057", gather = true },
            { map = "126092057", changeMap = "goto:126092058", gather = true },
            { map = "126092058", changeMap = "goto:126092059", gather = true },
            { map = "126092059", changeMap = "goto:126093083", gather = true },
            { map = "126093083", changeMap = "goto:126093595", gather = true },
            { map = "126093595", changeMap = "goto:126092572", gather = true },
            { map = "126092572", changeMap = "goto:126092060", gather = true },
            { map = "126092060", changeMap = "goto:126092061", gather = true },
            { map = "126092061", changeMap = "goto:126092573", gather = true },
            { map = "126092573", changeMap = "goto:126092062", gather = true },
            { map = "126092062", changeMap = "goto:126091550", gather = true },
            { map = "126091550", changeMap = "goto:126223133", gather = true },
            { map = "126223133", changeMap = "goto:126091549", gather = true },
            { map = "126091549", changeMap = "goto:126091548", gather = true },
            { map = "126091548", changeMap = "goto:126223132", gather = true },
            { map = "126223132", changeMap = "goto:126223131", gather = true },
            { map = "126223131", changeMap = "goto:126091547", gather = true },
            { map = "126091547", changeMap = "goto:126091546", gather = true },
            { map = "126091546", changeMap = "goto:126223130", gather = true },
            { map = "126223130", changeMap = "goto:126223642", gather = true },
            { map = "126223642", changeMap = "goto:126223129", gather = true },
            { map = "126223129", changeMap = "goto:126223128", gather = true },
            { map = "126223128", changeMap = "goto:126223127", gather = true },
            { map = "126223127", changeMap = "goto:126091543", gather = true },
            { map = "126091543", changeMap = "goto:126091542", gather = true },
            { map = "126091542", changeMap = "goto:126092054", gather = true },
            { map = "126092054", changeMap = "goto:126092055", gather = true },
            { map = "126092055", changeMap = "goto:126092056", gather = true },
            { map = "126092056", custom = nextChemin, gather = true },
        }
    end
end

function bank()
    if type(inventory) == "table" and type(inventory.openBags) == "function" then
        inventory:openBags()
    end
    return {
        { map = "havenbag", changeMap = "zaap:191105026" },
        { map = "191105026", changeMap = "goto:192415750" },
        { map = "192415750", npcBank = true },
    }
end