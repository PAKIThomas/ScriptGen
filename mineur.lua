-- MizanBot READY | Mineur 1-200 AUTO | API 2026-09
-- Niveau Mineur lu automatiquement via getJobLevel(24).
-- MINER_LEVEL_OVERRIDE > 0 sert uniquement pour un test manuel ponctuel.

MAX_PODS = 90
ELEMENTS_TO_GATHER = {}
MIN_MONSTERS = 1
MAX_MONSTERS = 8

MINER_LEVEL_OVERRIDE = 0
SAFE_RECOVERY = true
ROUTE_RANDOM = true
ECONOMY_MODE = true
SAME_MINE_PASSES = 3
MAX_WALK_ROTATION = 30
ALLOW_DISTANT_ROTATION = false
FORCE_ROUTE = ""
DISABLED_ROUTES = {}
MAX_FAILURES = 3
STUCK_TICKS = 5

local BANK_OUTSIDE = 191104002
local BANK_INSIDE = 192415750
local BANK_DOOR_CELL = 288

local ROUTES = {
  ["Yjupe"] = {
    entryMap=88212250, entryCell=248, entryWorldMap=88212250, entryTarget=97255955, hubMap=0,
    actionBudget=18, exitMap=88212250,
    exitNext={[97255955]=88212250,[97256979]=97255955,[97258003]=97256979,[97259027]=97258003,[97260051]=97259027,[97261075]=97259027},
    walkDistance={["Auderie"]=9,["Estrone"]=48,["GrandReseau"]=15,["Herale"]=27,["Hipouce"]=67,["Hurlement"]=39,["Kobalte"]=31},
    entryPos="", hasExit=true, surface={},
    actions={[97255955]={kind="cell",value=512},[97256979]={kind="cell",value=248},[97258003]={kind="cell",value=228},[97259027]={kind="randomcell",values={267,194}},[97261075]={kind="exit",target=88212250},[97260051]={kind="exit",target=88212250},},
  },
  ["Auderie"] = {
    entryMap=88213267, entryCell=236, entryWorldMap=88213267, entryTarget=97255949, hubMap=0,
    actionBudget=12, exitMap=88213267,
    exitNext={[97255949]=88213267,[97256973]=97255949,[97257997]=97256973,[97259021]=97257997},
    walkDistance={["Estrone"]=53,["GrandReseau"]=10,["Herale"]=22,["Hipouce"]=72,["Hurlement"]=44,["Kobalte"]=26,["Yjupe"]=9},
    entryPos="", hasExit=true, surface={},
    actions={[97255949]={kind="cell",value=376},[97256973]={kind="cell",value=122},[97257997]={kind="cell",value=235},[97259021]={kind="exit",target=88213267},},
  },
  ["Estrone"] = {
    entryMap=171966987, entryCell=397, entryWorldMap=171966987, entryTarget=178785286, hubMap=0,
    actionBudget=12, exitMap=171966987,
    exitNext={[178785286]=171966987,[178785288]=178785286},
    walkDistance={["Auderie"]=61,["GrandReseau"]=64,["Herale"]=54,["Hipouce"]=21,["Hurlement"]=17,["Kobalte"]=68,["Yjupe"]=56},
    entryPos="", hasExit=true, surface={},
    actions={[178785286]={kind="interactive",value=99},[178785288]={kind="exit",target=171966987},},
  },
  ["Hurlement"] = {
    entryMap=171707908, entryCell=166, entryWorldMap=171707908, entryTarget=178784264, hubMap=0,
    actionBudget=12, exitMap=171707908,
    exitNext={[178784264]=171707908},
    walkDistance={["Auderie"]=44,["Estrone"]=17,["GrandReseau"]=54,["Herale"]=66,["Hipouce"]=36,["Kobalte"]=70,["Yjupe"]=39},
    entryPos="", hasExit=true, surface={},
    actions={[178784264]={kind="exit",target=171707908},},
  },
  ["Saharach"] = {
    entryMap=173278720, entryCell=133, entryWorldMap=173278720, entryTarget=173935364, hubMap=0,
    actionBudget=15, exitMap=173278720,
    exitNext={[173277184]=173277696,[173277696]=173278208,[173278208]=173278720,[173539332]=173277184,[173935364]=173278720,[173936388]=173935364,[173937412]=173936388,[173938436]=173937412,[173939460]=173539332},
    walkDistance={},
    entryPos="", hasExit=true, surface={},
    actions={[173935364]={kind="interactive",value=297},[173936388]={kind="interactive",value=450},[173937412]={kind="interactive",value=382},[173938436]={kind="interactive",value=367},[173939460]={kind="exit",target=173278720},},
  },
  ["Herale"] = {
    entryMap=88082692, entryCell=332, entryWorldMap=88082692, entryTarget=97260033, hubMap=0,
    actionBudget=24, exitMap=88082692,
    exitNext={[97255939]=97261057,[97256963]=97255939,[97257987]=97261057,[97259011]=97261057,[97260033]=88082692,[97260035]=97257987,[97261057]=97260033,[97261059]=97260033},
    walkDistance={["Auderie"]=22,["Estrone"]=57,["GrandReseau"]=18,["Hipouce"]=76,["Hurlement"]=58,["Kobalte"]=16,["Yjupe"]=27},
    entryPos="", hasExit=false, surface={},
    actions={[97260033]={kind="cellprev",default=405,from={[97261057]=183}},[97261059]={kind="cell",value=417},[97261057]={kind="cellprev",default=227,from={[97260033]=421,[97259011]=235}},[97259011]={kind="cell",value=276},[97255939]={kind="cell",value=446},[97256963]={kind="cell",value=492},[97257987]={kind="cellprev",default=212,from={[97256963]=492}},[97260035]={kind="cell",value=288},},
  },
  ["Hipouce"] = {
    entryMap=173018629, entryCell=82, entryWorldMap=173018629, entryTarget=178784260, hubMap=0,
    actionBudget=33, exitMap=173018629,
    exitNext={[173017605]=173018117,[173017606]=173017605,[173018117]=173018629,[178782208]=173017606,[178782210]=178782208,[178782214]=178783236,[178782216]=178782214,[178782218]=178782216,[178782220]=178782218,[178783232]=178783236,[178783234]=178783232,[178783236]=178784260,[178784256]=178783232,[178784260]=173018629},
    walkDistance={["Auderie"]=49,["Estrone"]=21,["GrandReseau"]=45,["Herale"]=35,["Hurlement"]=36,["Kobalte"]=49,["Yjupe"]=54},
    entryPos="", hasExit=false, surface={},
    actions={[178784260]={kind="interactive",value=421},[178783236]={kind="interactiveprev",default=138,from={[178784260]=555,[178783232]=309}},[178783232]={kind="interactiveprev",default=200,from={[178783236]=204,[178784256]=406}},[178784256]={kind="interactive",value=505},[178782208]={kind="interactive",value=316},[178782210]={kind="interactive",value=207},[178783234]={kind="interactive",value=203},[178782214]={kind="interactiveprev",default=150,from={[178783236]=507}},[178782216]={kind="interactiveprev",default=122,from={[178782214]=422}},[178782218]={kind="interactiveprev",default=122,from={[178782216]=476}},[178782220]={kind="interactive",value=57},},
  },
  ["Kobalte"] = {
    entryMap=0, entryCell=403, entryWorldMap=88087305, entryTarget=117440512, hubMap=88085249,
    actionBudget=21, exitMap=88085249,
    exitNext={[88085250]=88085249,[88085251]=88085250,[88085763]=88085251,[88086275]=88085763,[88086276]=88086275,[88086277]=88086276,[88086789]=88086277,[88086790]=88086789,[88086791]=88086790,[88086792]=88086791,[88086793]=88086792,[88087305]=88086793,[117440512]=88087305,[117440514]=117443584,[117441536]=117440512,[117441538]=117440514,[117442560]=117441536,[117442562]=117441538,[117443584]=117442560},
    walkDistance={["Auderie"]=30,["Estrone"]=65,["GrandReseau"]=26,["Herale"]=8,["Hipouce"]=84,["Hurlement"]=66,["Yjupe"]=35},
    entryPos="14,14", hasExit=true, surface={["10,22"]="right",["11,22"]="right",["12,22"]="top",["12,21"]="right",["13,21"]="top",["13,20"]="top",["13,19"]="top",["13,18"]="top",["13,17"]="top",["13,16"]="top",["13,15"]="top",["13,14"]="right"},
    actions={[117440512]={kind="interactive",value=222},[117441536]={kind="interactive",value=167},[117442560]={kind="interactive",value=488},[117443584]={kind="interactive",value=221},[117440514]={kind="interactive",value=293},[117441538]={kind="interactive",value=251},[117442562]={kind="exit",target=88085249},},
  },
  ["GrandReseau"] = {
    entryMap=88213774, entryCell=353, entryWorldMap=88213774, entryTarget=97259013, hubMap=0,
    actionBudget=66, exitMap=88213774,
    exitNext={[88080644]=88080645,[88080645]=88080646,[88080646]=88080647,[88080647]=88080648,[88080648]=88080649,[88080649]=88080650,[88080650]=88080651,[88080651]=88080652,[88080652]=88080653,[88080653]=88080654,[88080654]=88212238,[88081156]=88080644,[88081668]=88081156,[88082180]=88081668,[88082692]=88082180,[88212238]=88212750,[88212750]=88213262,[88213262]=88213774,[97255943]=97261061,[97255945]=97261063,[97255947]=97261065,[97256967]=97259013,[97256969]=97255945,[97256971]=97255947,[97257991]=97260037,[97257993]=97260039,[97257995]=97256971,[97259013]=88213774,[97259015]=97261061,[97259017]=97261063,[97259019]=97261065,[97260033]=88082692,[97260037]=97259013,[97260039]=97256967,[97260041]=97255945,[97260043]=97259019,[97261061]=97260037,[97261063]=97260039,[97261065]=97257993,[97261067]=97256971},
    walkDistance={["Auderie"]=10,["Estrone"]=51,["Herale"]=18,["Hipouce"]=70,["Hurlement"]=52,["Kobalte"]=22,["Yjupe"]=15},
    entryPos="", hasExit=false, surface={},
    actions={[97259013]={kind="cellprev",default=258,from={[97260037]=276}},[97260033]={kind="cellprev",default=405,from={[97261057]=183}},[97260037]={kind="cellprev",default=430,from={[97259013]=303,[97257991]=352}},[97257991]={kind="cell",value=464},[97261061]={kind="cellprev",default=458,from={[97260037]=290,[97259015]=284}},[97259015]={kind="cell",value=451},[97255943]={kind="cell",value=403},[97256967]={kind="cellprev",default=518,from={[97259013]=194}},[97260039]={kind="cellprev",default=451,from={[97256967]=241,[97261063]=262}},[97261063]={kind="cellprev",default=459,from={[97260039]=331,[97259017]=296}},[97259017]={kind="cell",value=436},[97255945]={kind="cellprev",default=416,from={[97261063]=332,[97260041]=213}},[97260041]={kind="cell",value=354},[97256969]={kind="cell",value=401},[97257993]={kind="cellprev",default=537,from={[97260039]=122}},[97261065]={kind="cellprev",default=479,from={[97257993]=213,[97255947]=236}},[97255947]={kind="cellprev",default=500,from={[97261065]=199}},[97256971]={kind="cellprev",default=503,from={[97255947]=234,[97261067]=239}},[97261067]={kind="cell",value=521},[97257995]={kind="cell",value=374},[97259019]={kind="cellprev",default=438,from={[97261065]=276}},[97260043]={kind="cell",value=451},},
  },
}
local CELL_DESTINATIONS = {
    [97255939] = {[446]=97256963},
    [97255943] = {[403]=97261061},
    [97255945] = {[213]=97256969, [332]=97260041, [416]=97261063},
    [97255947] = {[199]=97256971, [500]=97261065},
    [97255949] = {[376]=97256973},
    [97255955] = {[512]=97256979},
    [97256963] = {[492]=97257987},
    [97256967] = {[194]=97260039, [518]=97259013},
    [97256969] = {[401]=97255945},
    [97256971] = {[234]=97261067, [239]=97257995, [503]=97255947},
    [97256973] = {[122]=97257997},
    [97256979] = {[248]=97258003},
    [97257987] = {[212]=97261057, [492]=97260035},
    [97257991] = {[464]=97260037},
    [97257993] = {[122]=97261065, [537]=97260039},
    [97257995] = {[374]=97256971},
    [97257997] = {[235]=97259021},
    [97258003] = {[228]=97259027},
    [97259011] = {[276]=97261057},
    [97259013] = {[258]=97260037, [276]=97256967},
    [97259015] = {[451]=97261061},
    [97259017] = {[436]=97261063},
    [97259019] = {[276]=97260043, [438]=97261065},
    [97259027] = {[194]=97260051, [267]=97261075},
    [97260033] = {[183]=97261059, [405]=97261057},
    [97260035] = {[288]=97257987},
    [97260037] = {[303]=97257991, [352]=97261061, [430]=97259013},
    [97260039] = {[241]=97261063, [262]=97257993, [451]=97256967},
    [97260041] = {[354]=97255945},
    [97260043] = {[451]=97259019},
    [97261057] = {[227]=97260033, [235]=97255939, [421]=97259011},
    [97261059] = {[417]=97260033},
    [97261061] = {[284]=97255943, [290]=97259015, [458]=97260037},
    [97261063] = {[296]=97255945, [331]=97259017, [459]=97260039},
    [97261065] = {[213]=97255947, [236]=97259019, [479]=97257993},
    [97261067] = {[521]=97256971},
}

local currentRoute = nil
local previousRoute = nil
local sameMinePasses = 0
local forceSwitch = false
local exitingRoute = nil
local lastMapId = -1
local failureCount = 0
local routeActionCount = 0
local sameSpot = 0
local seenMap = -1
local seenCell = -2
local MINER_LEVEL = 0
local levelWarning = false

local function log(msg) printMessage("[Mineur AUTO] " .. tostring(msg), "info") end
local function warn(msg) printWarning("[Mineur AUTO] " .. tostring(msg)) end
local function err(msg) printError("[Mineur AUTO] " .. tostring(msg)) end
local function ok(msg) printSuccess("[Mineur AUTO] " .. tostring(msg)) end

local function escapeViaKnownZaap()
    if not zaap or not zaap.known or not zaap.travel then return false end
    local known = zaap:known() or {}
    for _, z in ipairs(known) do
        local mid = tonumber(z.mapId)
        if mid and mid > 0 and zaap:travel(mid) then
            warn("Recovery via zaap direct -> " .. tostring(mid))
            return true
        end
    end
    return false
end

local function refreshMinerLevel()
    local level = MINER_LEVEL_OVERRIDE > 0 and MINER_LEVEL_OVERRIDE or getJobLevel(24)
    level = tonumber(level) or 0
    if level <= 0 then
        if not levelWarning then warn("Niveau Mineur inconnu/non appris (jobId=24)") levelWarning = true end
        return false
    end
    levelWarning = false
    if level ~= MINER_LEVEL then
        local previous = MINER_LEVEL
        MINER_LEVEL = level
        if previous > 0 then
            currentRoute = nil
            exitingRoute = nil
            sameMinePasses = 0
            forceSwitch = false
            lastMapId = -1
            routeActionCount = 0
            ok("Niveau Mineur mis à jour automatiquement: " .. tostring(level))
        end
    end
    return true
end

local function poolForLevel(level)
    if level < 40 then
        return {"Herale", "Yjupe", "Auderie"}
    elseif level < 60 then
        return {"GrandReseau", "Herale", "Auderie"}
    elseif level < 100 then
        return {"GrandReseau", "Hipouce", "Kobalte"}
    elseif level < 160 then
        return {"GrandReseau", "Hipouce", "Kobalte", "Estrone", "Hurlement"}
    else
        return {"GrandReseau", "Hipouce", "Estrone", "Hurlement", "Saharach"}
    end
end

local function routeContainingMap(mapId)
    local eligible = poolForLevel(MINER_LEVEL)
    for _, name in ipairs(eligible) do
        local r = ROUTES[name]
        if r and (r.actions[mapId] ~= nil or (r.entryWorldMap > 0 and r.entryWorldMap == mapId)) then
            return name
        end
    end
    return nil
end

local function chooseRoute()
    if FORCE_ROUTE ~= "" and ROUTES[FORCE_ROUTE] and not DISABLED_ROUTES[FORCE_ROUTE] then
        currentRoute = FORCE_ROUTE
        previousRoute = FORCE_ROUTE
        exitingRoute = nil
        lastMapId = -1
        routeActionCount = 0
        ok("Route forcée: " .. FORCE_ROUTE)
        return
    end
    local raw = poolForLevel(MINER_LEVEL)
    local pool = {}
    for _, name in ipairs(raw) do if not DISABLED_ROUTES[name] then table.insert(pool, name) end end
    if #pool == 0 then err("Aucune route active pour ce palier") stopScript() return end
    local idx = 1
    if ROUTE_RANDOM and #pool > 1 then idx = math.random(1, #pool) end
    local chosen = pool[idx]
    local previousAllowed = false
    for _, name in ipairs(pool) do
        if name == previousRoute then previousAllowed = true end
    end
    if ECONOMY_MODE and previousAllowed then
        if sameMinePasses < SAME_MINE_PASSES and not forceSwitch then
            chosen = previousRoute
            log("Économie zaap: passage " .. tostring(sameMinePasses + 1) .. "/" .. tostring(SAME_MINE_PASSES) .. " dans " .. chosen)
        else
            local nearby = ROUTES[previousRoute].walkDistance or {}
            local nearest = nil
            local best = math.huge
            for _, name in ipairs(pool) do
                local hops = nearby[name]
                if name ~= previousRoute and hops and hops < best then
                    best = hops
                    nearest = name
                end
            end
            if nearest and (best <= MAX_WALK_ROTATION or ALLOW_DISTANT_ROTATION) then
                chosen = nearest
                log("Économie zaap: mine proche " .. chosen .. " (" .. tostring(best) .. " cartes à pied)")
            elseif forceSwitch then
                err("Recovery: aucune autre mine proche; arrêt pour éviter une boucle/zaap coûteux.")
                stopScript()
                return
            else
                chosen = previousRoute
                sameMinePasses = 0
                warn("Économie zaap: aucune mine proche, nouveau cycle sur " .. chosen)
            end
        end
    elseif chosen == previousRoute and #pool > 1 then
        idx = (idx % #pool) + 1
        chosen = pool[idx]
    end
    if chosen ~= previousRoute then sameMinePasses = 0 end
    previousRoute = chosen
    currentRoute = chosen
    exitingRoute = nil
    forceSwitch = false
    lastMapId = -1
    routeActionCount = 0
    ok("Route: " .. chosen .. " | niveau Mineur=" .. tostring(MINER_LEVEL))
end

local function recover(label)
    failureCount = failureCount + 1
    warn(label .. " | échec " .. tostring(failureCount) .. "/" .. tostring(MAX_FAILURES))
    if SAFE_RECOVERY and failureCount >= MAX_FAILURES then
        failureCount = 0
        if currentRoute and ROUTES[currentRoute] then
            exitingRoute = currentRoute
            forceSwitch = true
            warn("Recovery: sortie progressive avec récolte de " .. tostring(currentRoute))
            return true
        end
        if escapeViaKnownZaap() then
            currentRoute = nil
            exitingRoute = nil
            lastMapId = -1
            chooseRoute()
            return true
        end
        err("Recovery worldgraph/zaap impossible; arrêt sécurisé pour éviter une boucle.")
        stopScript()
        return true
    end
    return false
end

local function stepExit()
    local name = exitingRoute
    local r = name and ROUTES[name] or nil
    if not r then
        err("Route de sortie inconnue: " .. tostring(name))
        exitingRoute = nil
        stopScript()
        return true
    end
    local current = getMapId()
    gatherAll()
    if current == r.exitMap then
        log("Sortie " .. tostring(name) .. " atteinte après récolte")
        if previousRoute == name then
            sameMinePasses = sameMinePasses + 1
        else
            sameMinePasses = 1
        end
        previousRoute = name
        exitingRoute = nil
        currentRoute = nil
        lastMapId = -1
        routeActionCount = 0
        failureCount = 0
        chooseRoute()
        return true
    end
    local nextMap = r.exitNext[current]
    if not nextMap then
        warn("Sortie " .. tostring(name) .. ": aucun saut depuis " .. tostring(current))
        if escapeViaKnownZaap() then
            previousRoute = name
            exitingRoute = nil
            currentRoute = nil
            lastMapId = -1
            routeActionCount = 0
            failureCount = 0
            chooseRoute()
            return true
        end
        err("Sortie progressive impossible; arrêt sécurisé.")
        stopScript()
        return true
    end
    log("Sortie " .. tostring(name) .. ": récolte puis " .. tostring(current) .. " -> " .. tostring(nextMap))
    local accepted = travelTo(nextMap)
    if accepted or getMapId() == nextMap then
        failureCount = 0
        return true
    end
    failureCount = failureCount + 1
    warn("Saut de sortie refusé (" .. tostring(failureCount) .. "/" .. tostring(MAX_FAILURES) .. ")")
    if failureCount >= MAX_FAILURES then
        if escapeViaKnownZaap() then
            previousRoute = name
            exitingRoute = nil
            currentRoute = nil
            lastMapId = -1
            routeActionCount = 0
            failureCount = 0
            chooseRoute()
        else
            err("Sortie progressive/zaap impossible; arrêt sécurisé.")
            stopScript()
        end
    end
    return true
end

local function moveThroughCell(cell)
    local current = getMapId()
    local byCell = CELL_DESTINATIONS[current]
    local target = byCell and byCell[cell]
    if not target then
        return recover("sortie worldgraph inconnue map " .. tostring(current) .. " cellule " .. tostring(cell))
    end
    local accepted = travelTo(target)
    if accepted or getMapId() == target then
        failureCount = 0
        return true
    end
    return recover("transition " .. tostring(current) .. " -> " .. tostring(target) .. " cellule " .. tostring(cell))
end

local function useInteractive(cell)
    local before = getMapId()
    local used = goUseInteractive(cell)
    if used or getMapId() ~= before then failureCount = 0 return true end
    if recover("interactif cellule " .. tostring(cell)) then return true end
    return false
end

local function executeAction(a, previousMap)
    if a.kind == "exit" then
        exitingRoute = currentRoute
        return stepExit()
    end
    gatherAll()
    if a.kind == "cell" then
        return moveThroughCell(a.value)
    elseif a.kind == "interactive" then
        return useInteractive(a.value)
    elseif a.kind == "randomcell" then
        return moveThroughCell(a.values[math.random(1,#a.values)])
    elseif a.kind == "cellprev" then
        return moveThroughCell((a.from and a.from[previousMap]) or a.default)
    elseif a.kind == "interactiveprev" then
        return useInteractive((a.from and a.from[previousMap]) or a.default)
    end
    return false
end

local function observeStuck()
    local m = getMapId()
    local c = getCurrentCell()
    if m == seenMap and c == seenCell then
        sameSpot = sameSpot + 1
    else
        sameSpot = 0
        seenMap = m
        seenCell = c
    end
    if sameSpot >= STUCK_TICKS then
        sameSpot = 0
        warn("Détection d'inactivité sur map/cell identiques")
        recover("stuck watchdog")
        return true
    end
    return false
end

local function routeStep(r, current, previous)
    local a = r.actions[current]
    if not a then return false end
    local routeBefore = currentRoute
    lastMapId = current
    local accepted = executeAction(a, previous)
    if accepted and currentRoute == routeBefore and not exitingRoute then
        routeActionCount = routeActionCount + 1
    end
    return true
end

function move()
    if not refreshMinerLevel() then delay(1000) return end
    if observeStuck() then return end
    local current = getMapId()
    local previous = lastMapId

    if exitingRoute then
        stepExit()
        return
    end

    if not currentRoute then
        local detected = routeContainingMap(current)
        if detected then
            currentRoute = detected
            routeActionCount = 0
            ok("Route détectée: " .. detected)
        else
            chooseRoute()
        end
    end

    local r = ROUTES[currentRoute]
    if not r then
        err("Route inconnue: " .. tostring(currentRoute))
        currentRoute = nil
        return
    end

    if routeActionCount >= (r.actionBudget or 24) then
        exitingRoute = currentRoute
        warn("Quota route atteint (" .. tostring(routeActionCount) .. "/" .. tostring(r.actionBudget or 24) .. ") -> sortie progressive avec récolte")
        stepExit()
        return
    end

    if routeStep(r, current, previous) then return end

    local pos = getCurrentPos()
    local dir = r.surface[pos]
    if dir then
        changeMap(dir)
        return
    end

    if (r.entryPos ~= "" and pos == r.entryPos) or (r.entryWorldMap and r.entryWorldMap > 0 and current == r.entryWorldMap) then
        log("Entrée " .. currentRoute .. " via worldgraph -> " .. tostring(r.entryTarget))
        if travelTo(r.entryTarget) or getMapId() == r.entryTarget then
            failureCount = 0
            return
        end
        recover("entrée worldgraph " .. tostring(currentRoute))
        return
    end

    if r.hubMap and r.hubMap > 0 then
        log("Voyage vers hub route " .. currentRoute)
        if not travelTo(r.hubMap) then recover("travelTo hub") end
        return
    end
    if r.entryMap and r.entryMap > 0 then
        log("Voyage vers entrée " .. currentRoute)
        if not travelTo(r.entryMap) then recover("travelTo entrée") end
        return
    end

    warn("Impossible de rejoindre " .. currentRoute .. ", rotation")
    previousRoute = currentRoute
    currentRoute = nil
end

function bank()
    local current = getMapId()
    if current == BANK_INSIDE then
        return { { map = tostring(BANK_INSIDE), npcBank = true, gather = true } }
    end

    if current ~= BANK_OUTSIDE then
        log("Pods pleins -> banque Astrub")
        if not travelTo(BANK_OUTSIDE) then recover("travelTo banque") end
        return
    end
    if not goUseInteractive(BANK_DOOR_CELL) then
        recover("porte banque Astrub")
    end
end

if type(printSuccess) == "function" then
    ok("Prêt | niveau Mineur automatique | jobId=24 | seuil pods=" .. tostring(MAX_PODS) .. "%")
end
