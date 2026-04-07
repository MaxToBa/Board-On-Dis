'use client'
import { useState, useEffect, useCallback, Suspense } from 'react'
import { motion } from 'framer-motion'
import GameLayout from '@/components/game/GameLayout'
import PlayerCard from '@/components/game/PlayerCard'
import RoomCode from '@/components/game/RoomCode'
import CoinFlip from '@/components/game/CoinFlip'
import ChatBox from '@/components/game/ChatBox'
import WaitingRoom from '@/components/game/phases/WaitingRoom'
import SetupRoom from '@/components/game/phases/SetupRoom'
import GameResult from '@/components/game/phases/GameResult'
import AiGameResult from '@/components/game/AiGameResult'
import Confetti from '@/components/ui/Confetti'
import { usePlayerInfo } from '@/hooks/usePlayerInfo'
import { useMultiplayerRoom } from '@/hooks/useMultiplayerRoom'
import { emptyGrid, fireShot, checkAllSunk, randomPlacement } from '@/lib/games/battleship'
import { sound } from '@/lib/sound'
import { saveGameResult } from '@/lib/saveGameResult'
import { COLOR_OPTIONS } from '@/types/room'
import type { Grid, Ship } from '@/lib/games/battleship'

const COL_LABELS = ['A','B','C','D','E','F','G','H','I','J']
const SHIP_NAMES = ['Carrier (5)', 'Battleship (4)', 'Cruiser (3)', 'Submarine (3)', 'Destroyer (2)']

// ─── BattleGrid ──────────────────────────────────────────────────────────────
function BattleGrid({
  grid, ships, isEnemy, canFire, onFire,
}: {
  grid: Grid; ships: Ship[]; isEnemy: boolean; canFire: boolean; onFire?: (r: number, c: number) => void
}) {
  const getCellStyle = (cell: string, r: number, c: number) => {
    const isShip = !isEnemy && ships.some(s => s.positions.some(([sr,sc]) => sr===r && sc===c))
    if (cell==='sunk') return 'bg-red/70 border-red/80 cursor-default'
    if (cell==='hit')  return 'bg-orange-500/60 border-orange-400/70 cursor-default'
    if (cell==='miss') return 'bg-blue-900/50 border-blue-700/40 cursor-default'
    if (isShip)        return 'bg-surface border-white/25 cursor-default'
    if (isEnemy && canFire) return 'bg-surface2 border-white/10 hover:bg-purple/30 hover:border-purple/40 cursor-crosshair'
    return 'bg-surface2 border-white/10 cursor-default'
  }
  return (
    <div className="select-none">
      <div className="flex ml-6 mb-1">
        {COL_LABELS.map(l => <div key={l} className="w-7 h-4 flex items-center justify-center text-[9px] text-muted font-bold">{l}</div>)}
      </div>
      <div className="flex">
        <div className="flex flex-col mr-1">
          {Array.from({length:10},(_,i)=>(
            <div key={i} className="w-5 h-7 flex items-center justify-center text-[9px] text-muted font-bold">{i+1}</div>
          ))}
        </div>
        <div className="grid gap-0.5" style={{gridTemplateColumns:'repeat(10, 1.75rem)'}}>
          {grid.map((row,r)=>row.map((cell,c)=>{
            const display = isEnemy && cell==='ship' ? 'empty' : cell
            const isShip = !isEnemy && ships.some(s=>s.positions.some(([sr,sc])=>sr===r&&sc===c))
            return (
              <motion.div key={`${r}-${c}`}
                onClick={()=> display!=='hit'&&display!=='miss'&&display!=='sunk'&&onFire?.(r,c)}
                whileHover={isEnemy&&canFire&&display!=='hit'&&display!=='miss'&&display!=='sunk'?{scale:1.15}:{}}
                className={`w-7 h-7 rounded-sm border transition-colors flex items-center justify-center relative ${getCellStyle(display,r,c)}`}
              >
                {cell==='hit'  && <span className="text-[10px] font-black text-orange-300">✕</span>}
                {cell==='sunk' && <span className="text-[10px] font-black text-red-300">💥</span>}
                {cell==='miss' && <span className="text-[11px] text-blue-400/80">·</span>}
                {isShip&&cell==='ship'&&<div className="w-3 h-3 rounded-sm bg-accent/60"/>}
              </motion.div>
            )
          }))}
        </div>
      </div>
    </div>
  )
}

// ─── Ship Placement UI ────────────────────────────────────────────────────────
function PlacementGrid({
  placedShips, hoverCells, onCellClick, onCellHover, onCellLeave,
}: {
  placedShips: Ship[]
  hoverCells: [number,number][]
  onCellClick: (r:number,c:number)=>void
  onCellHover: (r:number,c:number)=>void
  onCellLeave: ()=>void
}) {
  const isPlaced = (r:number,c:number)=>placedShips.some(s=>s.positions.some(([sr,sc])=>sr===r&&sc===c))
  const isHover = (r:number,c:number)=>hoverCells.some(([hr,hc])=>hr===r&&hc===c)
  const isConflict = (r:number,c:number)=>isHover(r,c)&&isPlaced(r,c)
  return (
    <div className="select-none">
      <div className="flex ml-6 mb-1">
        {COL_LABELS.map(l=><div key={l} className="w-7 h-7 flex items-center justify-center text-[9px] text-muted font-bold">{l}</div>)}
      </div>
      <div className="flex">
        <div className="flex flex-col mr-1">
          {Array.from({length:10},(_,i)=>(
            <div key={i} className="w-5 h-7 flex items-center justify-center text-[9px] text-muted font-bold">{i+1}</div>
          ))}
        </div>
        <div className="grid gap-0.5" style={{gridTemplateColumns:'repeat(10, 1.75rem)'}}>
          {Array.from({length:10},(_,r)=>Array.from({length:10},(_,c)=>(
            <div key={`${r}-${c}`}
              onClick={()=>onCellClick(r,c)}
              onMouseEnter={()=>onCellHover(r,c)}
              onMouseLeave={onCellLeave}
              className={`w-7 h-7 rounded-sm border cursor-pointer transition-colors
                ${isConflict(r,c)?'bg-red/50 border-red/70'
                  :isHover(r,c)?'bg-accent/40 border-accent/60'
                  :isPlaced(r,c)?'bg-accent/60 border-accent/40'
                  :'bg-surface2 border-white/10 hover:border-white/25'}`}
            />
          )))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function BattleshipPage() {
  const { playerName, avatarUrl, userId, isAuthenticated, roomId, mode, isHost, difficulty } = usePlayerInfo()

  // My fleet
  const [myGrid, setMyGrid]   = useState<Grid>(emptyGrid())
  const [myShips, setMyShips] = useState<Ship[]>([])
  // Enemy fleet (only visible after hit/miss)
  const [enemyGrid, setEnemyGrid]   = useState<Grid>(emptyGrid())
  const [enemyShips, setEnemyShips] = useState<Ship[]>([])  // used by AI only

  const [myTurn,   setMyTurn]   = useState(true)
  const [winner,   setWinner]   = useState<'me'|'enemy'|null>(null)
  const [coinWinner, setCoinWinner] = useState<string|null>(null)
  const [battlePhase, setBattlePhase] = useState<'place'|'battle'>('place')
  const [aiThinking, setAiThinking]  = useState(false)
  const [selectedColor, setSelectedColor] = useState('blue')

  // Ship placement UI state
  const [selectedShipIdx, setSelectedShipIdx] = useState<number|null>(null)
  const [isHorizontal, setIsHorizontal] = useState(true)
  const [hoverCells, setHoverCells] = useState<[number,number][]>([])
  const [myPlacedShips, setMyPlacedShips] = useState<Ship[]>([])
  const [myShipReady, setMyShipReady] = useState(false)
  const [opponentShipReady, setOpponentShipReady] = useState(false)

  const isMultiplayer = mode === 'multiplayer' && !!roomId
  const SHIP_SIZES_LIST = [5,4,3,3,2]

  const {
    phase, hostInfo, guestInfo, myInfo, opponentInfo,
    currentTurn: roomTurn, winner: roomWinner,
    rematchVotes,
    markReady, updateGameData, finishGame, requestRematch,
  } = useMultiplayerRoom({
    roomId: isMultiplayer ? roomId : '',
    isHost,
    playerName,
    avatarUrl,
    userId,
    onGameStateChange: useCallback((state: Record<string, unknown>) => {
      if (!isMultiplayer) return
      const myKey   = isHost ? 'hostGrid'  : 'guestGrid'
      const oppKey  = isHost ? 'guestGrid' : 'hostGrid'
      const myReadyKey  = isHost ? 'hostShipReady'  : 'guestShipReady'
      const oppReadyKey = isHost ? 'guestShipReady' : 'hostShipReady'

      // Opponent fires → updates MY grid and my ships
      if (state[myKey]) setMyGrid(state[myKey] as Grid)
      // I fire → enemy grid updated from state
      if (state[oppKey]) setEnemyGrid(state[oppKey] as Grid)
      // Store enemy ships (for sunk checking)
      const oppShipsKey = isHost ? 'guestShips' : 'hostShips'
      if (state[oppShipsKey]) setEnemyShips(state[oppShipsKey] as Ship[])
      // Store my ships (updated after being hit)
      const myShipsKey = isHost ? 'hostShips' : 'guestShips'
      if (state[myShipsKey]) setMyShips(state[myShipsKey] as Ship[])

      if (state[oppReadyKey]) setOpponentShipReady(true)
      if (state[myReadyKey])  setMyShipReady(true)
      if (state.currentTurn)  setMyTurn(state.currentTurn === (isHost ? 'host' : 'guest'))
      if (state.battlePhase === 'battle') setBattlePhase('battle')
    }, [isMultiplayer, isHost]),
  })

  // When coin_flip phase → show coin flip animation
  useEffect(() => {
    if (!isMultiplayer || phase !== 'coin_flip' || !hostInfo || !guestInfo) return
    const firstPlayerName = roomTurn === 'host' ? hostInfo.name : guestInfo.name
    setCoinWinner(firstPlayerName)
  }, [phase, isMultiplayer]) // eslint-disable-line react-hooks/exhaustive-deps

  // When playing phase starts → go to ship placement
  useEffect(() => {
    if (!isMultiplayer || phase !== 'playing') return
    setBattlePhase('place')
  }, [phase, isMultiplayer])

  // Both ship-ready → start battle (host decides)
  useEffect(() => {
    if (!isMultiplayer || !isHost || !myShipReady || !opponentShipReady) return
    if (battlePhase === 'battle') return
    updateGameData({ battlePhase: 'battle' })
    setBattlePhase('battle')
  }, [myShipReady, opponentShipReady, isHost, isMultiplayer, battlePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI mode init
  useEffect(() => {
    if (mode !== 'ai') return
    const ships = randomPlacement()
    const grid  = emptyGrid()
    ships.forEach(s=>s.positions.forEach(([r,c])=>{ grid[r][c]='ship' }))
    setMyShips(ships); setMyGrid(grid)
    const enemySh = randomPlacement()
    const enemyG  = emptyGrid()
    enemySh.forEach(s=>s.positions.forEach(([r,c])=>{ enemyG[r][c]='ship' }))
    setEnemyShips(enemySh); setEnemyGrid(enemyG)
    setTimeout(()=>{ setCoinWinner(Math.random()<0.5?playerName:'AI'); setBattlePhase('battle') },300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // AI takes shot
  useEffect(() => {
    if (mode!=='ai'||myTurn||winner||battlePhase!=='battle') return
    setAiThinking(true)
    setTimeout(()=>{
      fetch('/api/ai/battleship',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({grid:myGrid,difficulty}) })
        .then(r=>r.json()).then(({row,col}:{row:number;col:number})=>handleIncomingFire(row,col))
        .catch(()=>{
          const avail:[number,number][]=[]
          for(let r=0;r<10;r++) for(let c=0;c<10;c++) if(myGrid[r][c]==='empty'||myGrid[r][c]==='ship') avail.push([r,c])
          if(avail.length){const[r,c]=avail[Math.floor(Math.random()*avail.length)];handleIncomingFire(r,c)}
        })
        .finally(()=>setAiThinking(false))
    }, 800)
  }, [myTurn, battlePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Incoming fire (opponent shot at MY grid) ──
  function handleIncomingFire(row:number,col:number) {
    const {grid,ships,result} = fireShot(myGrid,myShips,row,col)
    if(result==='already') return
    setMyGrid(grid); setMyShips(ships)
    if(result==='hit'||result==='sunk') sound.hit(); else sound.miss()
    if(checkAllSunk(ships)){
      setWinner('enemy'); sound.lose(); saveResult('loss')
      if(isMultiplayer) finishGame(isHost ? 'guest' : 'host')
    } else {
      setMyTurn(true)
      if(isMultiplayer){
        const myGridKey  = isHost ? 'hostGrid'  : 'guestGrid'
        const myShipsKey = isHost ? 'hostShips' : 'guestShips'
        updateGameData({ [myGridKey]:grid, [myShipsKey]:ships, currentTurn:isHost?'host':'guest' })
      }
    }
  }

  // ── I fire at enemy ──
  function handleMyFire(row:number,col:number){
    if(!myTurn||winner||battlePhase!=='battle') return
    // In multiplayer, enemyShips is populated from DB via onGameStateChange
    const {grid,ships,result} = fireShot(enemyGrid, enemyShips, row, col)
    if(result==='already') return
    setEnemyGrid(grid); setEnemyShips(ships)
    if(result==='hit'||result==='sunk') sound.hit(); else sound.miss()

    // Check if all enemy ships sunk — use grid cells since ships might be empty for MP
    const allSunk = isMultiplayer
      ? !grid.flat().some((cell:string) => cell === 'ship' || cell === 'hit')
      : checkAllSunk(ships)

    if(allSunk){
      setWinner('me'); sound.win(); saveResult('win')
      if(isMultiplayer){
        const oppGridKey  = isHost ? 'guestGrid'  : 'hostGrid'
        const oppShipsKey = isHost ? 'guestShips' : 'hostShips'
        updateGameData({ [oppGridKey]:grid, [oppShipsKey]:ships })
        finishGame(isHost ? 'host' : 'guest')
      }
    } else {
      setMyTurn(false)
      if(isMultiplayer){
        const oppGridKey  = isHost ? 'guestGrid'  : 'hostGrid'
        const oppShipsKey = isHost ? 'guestShips' : 'hostShips'
        updateGameData({ [oppGridKey]:grid, [oppShipsKey]:ships, currentTurn:isHost?'guest':'host' })
      }
    }
  }

  function saveResult(result:'win'|'loss'){
    if(!isAuthenticated||!userId) return
    saveGameResult({
      userId, playerName, game:'battleship', result,
      opponent:mode==='ai'?'AI':(opponentInfo?.name??'เพื่อน'),
    })
  }

  // ── Ship Placement ──
  function getHoverCells(r:number,c:number,shipSize:number):([number,number][]){
    const cells:[number,number][]=[]
    for(let i=0;i<shipSize;i++){
      const nr=isHorizontal?r:r+i
      const nc=isHorizontal?c+i:c
      if(nr>=10||nc>=10){return []}
      cells.push([nr,nc])
    }
    return cells
  }

  function onPlacementHover(r:number,c:number){
    if(selectedShipIdx===null) return
    setHoverCells(getHoverCells(r,c,SHIP_SIZES_LIST[selectedShipIdx]))
  }

  function onPlacementClick(r:number,c:number){
    if(selectedShipIdx===null) return
    const size=SHIP_SIZES_LIST[selectedShipIdx]
    const cells=getHoverCells(r,c,size)
    if(!cells.length) return
    // Check conflict with already placed ships
    const conflict=myPlacedShips.some(s=>s.positions.some(([sr,sc])=>cells.some(([cr,cc])=>sr===cr&&sc===cc)))
    if(conflict) return
    const newShip:Ship={ id:`ship-${selectedShipIdx}`, size, positions:cells, hits:0 }
    const newPlaced=[...myPlacedShips.filter(s=>s.id!==newShip.id), newShip]
    setMyPlacedShips(newPlaced)
    setSelectedShipIdx(null)
    setHoverCells([])
  }

  function randomizeMyShips(){
    const ships=randomPlacement()
    setMyPlacedShips(ships)
    setSelectedShipIdx(null)
    setHoverCells([])
  }

  async function confirmShipPlacement(){
    if(myPlacedShips.length<5) return
    const grid=emptyGrid()
    myPlacedShips.forEach(s=>s.positions.forEach(([r,c])=>{ grid[r][c]='ship' }))
    setMyShips(myPlacedShips)
    setMyGrid(grid)
    setMyShipReady(true)

    if(isMultiplayer){
      const myGridKey  = isHost ? 'hostGrid'      : 'guestGrid'
      const myShipsKey = isHost ? 'hostShips'     : 'guestShips'
      const myReadyKey = isHost ? 'hostShipReady' : 'guestShipReady'
      await updateGameData({ [myGridKey]:grid, [myShipsKey]:myPlacedShips, [myReadyKey]:true })
    } else {
      setBattlePhase('battle')
    }
  }

  function handleRematch(){
    setMyGrid(emptyGrid()); setMyShips([]); setEnemyGrid(emptyGrid()); setEnemyShips([])
    setWinner(null); setMyTurn(true); setBattlePhase('place')
    setMyPlacedShips([]); setMyShipReady(false); setOpponentShipReady(false)
    requestRematch({
      hostGrid:emptyGrid(), guestGrid:emptyGrid(),
      hostShipReady:false, guestShipReady:false,
      battlePhase:'place', currentTurn:'host',
    })
  }

  const getStatus=()=>{
    if(winner) return winner==='me'?'🎉 คุณชนะ!':'💀 แพ้แล้ว...'
    if(aiThinking) return '🤖 AI กำลังยิง...'
    if(battlePhase==='battle') return myTurn?'🎯 ตาของคุณ — เลือกยิง':'⏳ รอผู้เล่นอีกฝั่ง'
    return '⚓ กำลังวางเรือ...'
  }
  const getStatusColor=():('green'|'red'|'accent'|'default')=>{
    if(winner) return winner==='me'?'green':'red'
    if(myTurn&&battlePhase==='battle') return 'accent'
    return 'default'
  }

  // ── MULTIPLAYER PHASE RENDERING ──
  if(isMultiplayer){
    if(phase==='waiting'&&isHost)
      return <GameLayout title="Battle Ship"><WaitingRoom roomCode={roomId}/></GameLayout>
    if(phase==='setup'||(phase==='waiting'&&!isHost))
      return (
        <GameLayout title="Battle Ship">
          <SetupRoom
            myInfo={myInfo??null} opponentInfo={opponentInfo??null}
            colorOptions={COLOR_OPTIONS} selectedColor={selectedColor}
            onSelectColor={setSelectedColor} onReady={()=>markReady(selectedColor)}
          />
        </GameLayout>
      )
    if(phase==='coin_flip'){
      const fpName=roomTurn==='host'?(hostInfo?.name??''):(guestInfo?.name??'')
      return (
        <GameLayout title="Battle Ship">
          <CoinFlip winner={fpName} onDone={()=>{ setCoinWinner(null) }}/>
        </GameLayout>
      )
    }

    // playing — ship placement phase
    if(phase==='playing'&&battlePhase==='place'){
      return (
        <GameLayout title="Battle Ship" status="วางเรือ" statusColor="accent"
          topLeft={<PlayerCard name={hostInfo?.name??playerName} avatar={hostInfo?.avatarUrl} label="Host" active={false}/>}
          topRight={
            <div className="flex flex-col items-end gap-2">
              <PlayerCard name={guestInfo?.name??'รอเพื่อน...'} avatar={guestInfo?.avatarUrl} label="Guest" active={false} flip/>
              {roomId&&<RoomCode code={roomId}/>}
            </div>
          }
        >
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-2xl text-white">วางเรือของคุณ</h2>
              <p className="text-muted text-sm mt-1">
                {opponentShipReady?`${opponentInfo?.name} วางเรือเสร็จแล้ว — รอคุณอยู่`:'วางเรือให้ครบแล้วกด Confirm'}
              </p>
            </div>

            {/* Ship selector */}
            <div className="flex flex-wrap gap-2 justify-center">
              {SHIP_SIZES_LIST.map((size,i)=>{
                const placed=myPlacedShips.some(s=>s.id===`ship-${i}`)
                return (
                  <button key={i} onClick={()=>setSelectedShipIdx(placed?null:i)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                      ${placed?'border-green/40 bg-green/10 text-green opacity-60'
                        :selectedShipIdx===i?'border-accent bg-accent/20 text-accent'
                        :'border-white/10 bg-surface2 text-muted hover:border-white/25'}`}>
                    {SHIP_NAMES[i]} {placed?'✓':''}
                  </button>
                )
              })}
              {selectedShipIdx!==null&&(
                <button onClick={()=>setIsHorizontal(h=>!h)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-purple/40 bg-purple/10 text-purple">
                  {isHorizontal?'↔ แนวนอน':'↕ แนวตั้ง'}
                </button>
              )}
            </div>

            <div className="flex justify-center">
              <PlacementGrid
                placedShips={myPlacedShips} hoverCells={hoverCells}
                onCellClick={onPlacementClick} onCellHover={onPlacementHover}
                onCellLeave={()=>setHoverCells([])}
              />
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={randomizeMyShips}
                className="px-4 py-2 bg-surface2 border border-white/10 rounded-xl text-sm font-bold hover:border-white/25 transition-all">
                🎲 สุ่มวาง
              </button>
              <button onClick={confirmShipPlacement} disabled={myPlacedShips.length<5||myShipReady}
                className="px-6 py-2 bg-accent text-bg rounded-xl text-sm font-bold hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {myShipReady?'✓ รอเพื่อน...':'✓ ยืนยัน'}
              </button>
            </div>

            <div className={`text-center text-sm font-bold py-2 rounded-xl
              ${opponentShipReady?'bg-green/10 text-green border border-green/20':'bg-surface2 text-muted border border-white/5'}`}>
              {opponentShipReady?`✓ ${opponentInfo?.name} พร้อมแล้ว!`:`⏳ รอ ${opponentInfo?.name} วางเรือ...`}
            </div>
          </div>
          {roomId&&<ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>}
        </GameLayout>
      )
    }
  } else {
    // AI: ship placement phase
    if(mode==='ai'&&battlePhase==='place'){
      return (
        <GameLayout title="Battle Ship" status="วางเรือ" statusColor="accent">
          <div className="space-y-4">
            <div className="text-center">
              <h2 className="font-display text-2xl text-white">วางเรือของคุณ</h2>
              <p className="text-muted text-sm">คลิกเพื่อวางทีละลำ หรือสุ่มวางอัตโนมัติ</p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {SHIP_SIZES_LIST.map((size,i)=>{
                const placed=myPlacedShips.some(s=>s.id===`ship-${i}`)
                return (
                  <button key={i} onClick={()=>setSelectedShipIdx(placed?null:i)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all
                      ${placed?'border-green/40 bg-green/10 text-green opacity-60'
                        :selectedShipIdx===i?'border-accent bg-accent/20 text-accent'
                        :'border-white/10 bg-surface2 text-muted hover:border-white/25'}`}>
                    {SHIP_NAMES[i]} {placed?'✓':''}
                  </button>
                )
              })}
              {selectedShipIdx!==null&&(
                <button onClick={()=>setIsHorizontal(h=>!h)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-purple/40 bg-purple/10 text-purple">
                  {isHorizontal?'↔ แนวนอน':'↕ แนวตั้ง'}
                </button>
              )}
            </div>
            <div className="flex justify-center">
              <PlacementGrid
                placedShips={myPlacedShips} hoverCells={hoverCells}
                onCellClick={onPlacementClick} onCellHover={onPlacementHover}
                onCellLeave={()=>setHoverCells([])}
              />
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={randomizeMyShips}
                className="px-4 py-2 bg-surface2 border border-white/10 rounded-xl text-sm font-bold hover:border-white/25">
                🎲 สุ่มวาง
              </button>
              <button onClick={confirmShipPlacement} disabled={myPlacedShips.length<5}
                className="px-6 py-2 bg-accent text-bg rounded-xl text-sm font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed">
                ▶ เริ่มเล่น!
              </button>
            </div>
          </div>
        </GameLayout>
      )
    }
  }

  // ── BATTLE PHASE ──
  const myShipsSunk   = myShips.filter(s=>s.positions.every(([r,c])=>myGrid[r][c]==='sunk'||myGrid[r][c]==='hit')).length
  const enemyShipsSunk = enemyShips.filter(s=>s.positions.every(([r,c])=>enemyGrid[r][c]==='sunk'||enemyGrid[r][c]==='hit')).length

  // Estimate enemy sunk from grid for multiplayer (no ship array available)
  const enemySunkCount = isMultiplayer
    ? Array.from({length:10}).reduce<number>((acc,_,r)=>
        acc + Array.from({length:10}).filter((_,c)=>enemyGrid[r][c]==='sunk').length, 0)
    : enemyShipsSunk

  return (
    <GameLayout
      title="Battle Ship" status={getStatus()} statusColor={getStatusColor()}
      topLeft={
        <PlayerCard
          name={isMultiplayer?(hostInfo?.name??playerName):playerName}
          avatar={isMultiplayer?hostInfo?.avatarUrl:avatarUrl}
          label="กองเรือของคุณ" active={!myTurn&&!winner}
        />
      }
      topRight={
        <div className="flex flex-col items-end gap-2">
          <PlayerCard
            name={isMultiplayer?(guestInfo?.name??'รอผู้เล่น...'):`AI (${({easy:'ง่าย',medium:'กลาง',hard:'ยาก'} as Record<string,string>)[difficulty]??'กลาง'})`}
            avatar={isMultiplayer?guestInfo?.avatarUrl:undefined}
            label="กองเรือศัตรู" active={myTurn&&!winner} flip
          />
          {isMultiplayer&&roomId&&<RoomCode code={roomId}/>}
        </div>
      }
    >
      {isMultiplayer&&phase==='finished'&&roomWinner&&hostInfo&&guestInfo&&(
        <GameResult winner={roomWinner} hostInfo={hostInfo} guestInfo={guestInfo}
          myName={playerName} rematchVotes={rematchVotes} onRematch={handleRematch}/>
      )}
      <Confetti active={!!winner&&winner==='me'&&(mode==='ai'||phase==='finished')}/>

      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-xl px-4 py-2">
          <span className="text-xs text-muted">เรือของคุณ</span>
          <span className="text-sm font-bold text-white">{myShips.length-myShipsSunk} / {myShips.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-surface border border-white/10 rounded-xl px-4 py-2">
          <span className="text-xs text-muted">เรือศัตรู</span>
          <span className="text-sm font-bold text-accent">{(isMultiplayer?5:enemyShips.length)-enemySunkCount} / {isMultiplayer?5:enemyShips.length}</span>
        </div>
      </div>

      <div className="flex gap-8 flex-wrap justify-center items-start">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">⚓ กองเรือของคุณ</p>
          <BattleGrid grid={myGrid} ships={myShips} isEnemy={false} canFire={false}/>
          <div className="flex gap-3 text-[9px] text-muted mt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-accent/60 inline-block"/>เรือ</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-orange-500/60 inline-block"/>โดนยิง</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-900/50 inline-block"/>พลาด</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted">🎯 กองเรือศัตรู</p>
          <BattleGrid grid={enemyGrid} ships={enemyShips} isEnemy={true}
            canFire={myTurn&&!winner&&battlePhase==='battle'} onFire={handleMyFire}/>
          {myTurn&&!winner&&battlePhase==='battle'&&(
            <p className="text-[10px] text-accent animate-pulse mt-1">คลิกที่ช่องเพื่อยิง</p>
          )}
        </div>
      </div>

      {winner&&mode==='ai'&&(
        <AiGameResult
          result={winner==='me'?'win':'loss'}
          playerName={playerName}
          aiName={`AI (${({easy:'ง่าย',medium:'กลาง',hard:'ยาก'} as Record<string,string>)[difficulty]??'กลาง'})`}
          onRestart={()=>window.location.reload()}
        />
      )}

      <CoinFlip winner={coinWinner} onDone={()=>setCoinWinner(null)}/>
      {isMultiplayer&&roomId&&<ChatBox roomId={roomId} playerName={playerName} playerAvatar={avatarUrl}/>}
    </GameLayout>
  )
}

export default function Page() {
  return <Suspense><BattleshipPage/></Suspense>
}
