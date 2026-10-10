--[[
  Script SnowBot : Bûcheron Astrub
]]
GATHER = { 1, 33 }
OPEN_BAGS = true
AUTO_DELETE = { 303 }

config:setMaxMonsters(5)
config:setForbiddenMonsters({ 98 })

function move()
	global:printMessage("Trajet bûcheron")
	if job:level(2) >= 20 then
		return {
			-- Forêt d'Astrub
			{ map = "4,-18", path = "right", gather = true },
			{ map = "5,-18", path = "left|bottom", forceGather = true }, -- repousse
			--{ map = "6,-18", path = "left" },
		}
	elseif job:level(2) >= 10 then
		return {
			{ map = "84674566", door = "303" },
			{ map = "3,-18", path = "zaap(84674566)", gather = true, fight = true }
		}
	else
		return {
			{ map = "4,-17", path = "top", gather = true }
		}
	end
end

function bank()
	return {
		-- Banque d'Astrub
		{ map = "84674563", npcBank = true },
	}
end

function fightManagement()
	fightBasic:playTurn()
end
