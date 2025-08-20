import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Pokemon-themed chessboard
// Single-file React component. Uses Tailwind CSS for styling and Framer Motion for animations.
// Drop this file into a React app (e.g., create-react-app / Vite) and render <PokemonChess />.
// Requirements: tailwindcss set up in the project and `npm install framer-motion`.

// Utility helpers
const files = ["a","b","c","d","e","f","g","h"];
const ranks = [8,7,6,5,4,3,2,1];

// Minimal chess move validation (not exhaustive or covering special moves like castling/en passant/pawn promotion).
// It's intentionally simplified but supports legal-like movement for pieces.
function isInside(r, f) {
  return r >= 0 && r < 8 && f >= 0 && f < 8;
}

// Convert board indices to algebraic notation (e.g., 0,0 -> a8)
function idxToAlgebraic(r, f){
  return `${files[f]}${ranks[r]}`;
}

function algebraicToIdx(square){
  const f = files.indexOf(square[0]);
  const r = ranks.indexOf(Number(square[1]));
  return [r, f];
}

// Generate empty board
function emptyBoard(){
  return Array(8).fill(null).map(()=>Array(8).fill(null));
}

// Pokemon set mapped to chess pieces (you can replace names or emojis)
const POKEMON = {
  pawn: { name: 'Pikachu', emoji: '⚡' },
  rook: { name: 'Snorlax', emoji: '😴' },
  knight: { name: 'Eevee', emoji: '🌀' },
  bishop: { name: 'Alakazam', emoji: '🔮' },
  queen: { name: 'Mewtwo', emoji: '👑' },
  king: { name: 'Charizard', emoji: '🔥' }
};

// Helper to clone board
function cloneBoard(b){
  return b.map(row => row.map(cell => cell ? {...cell} : null));
}

// Setup starting position with "pokemon" names instead of classic chess notation.
function startingBoard(){
  const b = emptyBoard();
  const backRank = ["rook","knight","bishop","queen","king","bishop","knight","rook"];
  // Black side (top)
  for(let f=0; f<8; f++){
    b[0][f] = { color: 'black', type: backRank[f], pokemon: POKEMON[backRank[f]] };
    b[1][f] = { color: 'black', type: 'pawn', pokemon: POKEMON.pawn };
    b[6][f] = { color: 'white', type: 'pawn', pokemon: POKEMON.pawn };
    b[7][f] = { color: 'white', type: backRank[f], pokemon: POKEMON[backRank[f]] };
  }
  return b;
}

// Basic movement generation for each piece type. Not fully chess-legal (no checks for own king in check), but reasonable.
function generateMoves(board, r, f){
  const cell = board[r][f];
  if(!cell) return [];
  const color = cell.color;
  const moves = [];

  const pushIf = (rr, ff) => {
    if(!isInside(rr,ff)) return;
    const target = board[rr][ff];
    if(!target) moves.push([rr,ff]);
    else if(target.color !== color) moves.push([rr,ff]);
  };

  switch(cell.type){
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      // forward
      if(isInside(r+dir, f) && !board[r+dir][f]) moves.push([r+dir,f]);
      // double
      if(r === startRow && !board[r+dir][f] && !board[r+2*dir][f]) moves.push([r+2*dir, f]);
      // captures
      [[r+dir,f-1],[r+dir,f+1]].forEach(([rr,ff])=>{
        if(isInside(rr,ff) && board[rr][ff] && board[rr][ff].color !== color) moves.push([rr,ff]);
      });
      break;
    }
    case 'rook': {
      const steps = [[1,0],[-1,0],[0,1],[0,-1]];
      for(const [dr,df] of steps){
        let rr=r+dr, ff=f+df;
        while(isInside(rr,ff)){
          if(!board[rr][ff]) moves.push([rr,ff]);
          else { if(board[rr][ff].color !== color) moves.push([rr,ff]); break; }
          rr+=dr; ff+=df;
        }
      }
      break;
    }
    case 'bishop': {
      const steps = [[1,1],[1,-1],[-1,1],[-1,-1]];
      for(const [dr,df] of steps){
        let rr=r+dr, ff=f+df;
        while(isInside(rr,ff)){
          if(!board[rr][ff]) moves.push([rr,ff]);
          else { if(board[rr][ff].color !== color) moves.push([rr,ff]); break; }
          rr+=dr; ff+=df;
        }
      }
      break;
    }
    case 'queen': {
      const steps = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
      for(const [dr,df] of steps){
        let rr=r+dr, ff=f+df;
        while(isInside(rr,ff)){
          if(!board[rr][ff]) moves.push([rr,ff]);
          else { if(board[rr][ff].color !== color) moves.push([rr,ff]); break; }
          rr+=dr; ff+=df;
        }
      }
      break;
    }
    case 'king': {
      for(let dr=-1; dr<=1; dr++) for(let df=-1; df<=1; df++){
        if(dr===0 && df===0) continue;
        pushIf(r+dr,f+df);
      }
      break;
    }
    case 'knight': {
      const jumps = [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]];
      for(const [dr,df] of jumps) pushIf(r+dr,f+df);
      break;
    }
  }

  return moves;
}

export default function PokemonChess(){
  const [board, setBoard] = useState(startingBoard);
  const [selected, setSelected] = useState(null); // [r,f]
  const [legal, setLegal] = useState([]); // array of [r,f]
  const [turn, setTurn] = useState('white');
  const [moveHistory, setMoveHistory] = useState([]);
  const [animating, setAnimating] = useState(false);

  useEffect(()=>{
    // keyboard undo (ctrl+z)
    const handler = (e)=>{
      if((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==='z') undo();
    };
    window.addEventListener('keydown', handler);
    return ()=> window.removeEventListener('keydown', handler);
  }, [moveHistory]);

  const onSquareClick = (r,f) => {
    if(animating) return; // don't allow inputs while animating
    const cell = board[r][f];
    if(selected){
      // if click same square, deselect
      if(selected[0]===r && selected[1]===f){ setSelected(null); setLegal([]); return; }
      // if clicked a legal move
      const isLegal = legal.some(([rr,ff])=> rr===r && ff===f);
      if(isLegal){
        doMove(selected, [r,f]);
        setSelected(null);
        setLegal([]);
        return;
      }
      // otherwise, if clicked on own piece, change selection
      if(cell && cell.color === turn){
        setSelected([r,f]);
        setLegal(generateMoves(board, r, f));
      } else {
        setSelected(null); setLegal([]);
      }
    } else {
      if(cell && cell.color === turn){
        setSelected([r,f]);
        setLegal(generateMoves(board, r, f));
      }
    }
  };

  function doMove(from, to){
    const [fr,ff]=from; const [tr,tf]=to;
    const b = cloneBoard(board);
    const mover = b[fr][ff];
    const captured = b[tr][tf];
    // Move piece
    b[tr][tf] = {...mover};
    b[fr][ff] = null;

    // minimal pawn promotion: promote to queen if reaches last rank
    if(mover.type === 'pawn' && (tr===0 || tr===7)){
      b[tr][tf].type = 'queen';
      b[tr][tf].pokemon = POKEMON.queen;
    }

    // Update board with animation state
    setAnimating(true);
    // Add to history for undo
    const moveRecord = {from, to, mover, captured};
    setMoveHistory(prev => [...prev, moveRecord]);

    // animate: we set board immediately for motion layout but use framer to show capture animation
    setBoard(b);

    // short delay to show animations
    setTimeout(()=>{
      setTurn(prev => prev === 'white' ? 'black' : 'white');
      setAnimating(false);
    }, 420); // match framer animation duration
  }

  function undo(){
    if(moveHistory.length === 0 || animating) return;
    const last = moveHistory[moveHistory.length-1];
    const b = cloneBoard(board);
    const {from,to,mover,captured} = last;
    const [fr,ff]=from; const [tr,tf]=to;
    // revert
    b[fr][ff] = {...mover};
    b[tr][tf] = captured ? {...captured} : null;
    setBoard(b);
    setMoveHistory(prev => prev.slice(0,-1));
    setTurn(prev=> prev==='white' ? 'black' : 'white');
  }

  // a small UI: status, undo button
  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Pokémon Chess</h1>
            <p className="text-sm text-slate-600">Turn: <span className={`font-semibold ${turn==='white'? 'text-amber-600':'text-sky-700'}`}>{turn}</span></p>
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={undo} className="px-3 py-1 rounded-md shadow-sm bg-white border">Undo (Ctrl+Z)</button>
            <button onClick={()=>{ setBoard(startingBoard()); setMoveHistory([]); setTurn('white'); }} className="px-3 py-1 rounded-md shadow bg-gradient-to-r from-rose-300 to-rose-400 text-white">Reset</button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8">
            <div className="relative w-full bg-white rounded-2xl shadow-lg p-4">
              <div className="grid grid-cols-8 gap-0 border rounded-lg overflow-hidden" style={{aspectRatio: '1'}}>
                {board.map((row, r)=> row.map((cell, f)=>{
                  const isLight = (r+f)%2===0;
                  const isSelected = selected && selected[0]===r && selected[1]===f;
                  const legalHere = legal.some(([rr,ff])=> rr===r && ff===f);
                  const squareKey = `${r}-${f}`;

                  return (
                    <div key={squareKey} onClick={()=>onSquareClick(r,f)} className={`relative flex items-center justify-center select-none cursor-pointer`}>
                      <div className={`absolute inset-0 ${isLight? 'bg-amber-50':'bg-sky-900'} ${isLight? 'bg-opacity-50':'bg-opacity-80'}`} />

                      {/* Highlight for selection */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div initial={{opacity:0}} animate={{opacity:0.18}} exit={{opacity:0}} className="absolute inset-0 bg-yellow-400 rounded-sm" />
                        )}
                      </AnimatePresence>

                      {/* Legal move indicator */}
                      <AnimatePresence>
                        {legalHere && (
                          <motion.div initial={{scale:0, opacity:0}} animate={{scale:1, opacity:0.9}} exit={{scale:0, opacity:0}} transition={{duration:0.25}} className="absolute w-6 h-6 rounded-full bg-white/70 flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-sky-700"></div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* piece render with motion */}
                      <div className="z-10 text-center">
                        <AnimatePresence>
                          {cell && (
                            <motion.div layoutId={`piece-${r}-${f}`} initial={{scale:0, y:10}} animate={{scale:1, y:0}} exit={{scale:0, rotate: -30, opacity:0}} transition={{type:'spring', stiffness: 700, damping: 30}} className="flex flex-col items-center gap-1">
                              <div className={`text-lg font-bold ${cell.color==='white' ? 'text-amber-600' : 'text-slate-50'}`}>{cell.pokemon.emoji}</div>
                              <div className={`text-[10px] ${cell.color==='white' ? 'text-amber-700' : 'text-slate-100'}`}>{cell.pokemon.name}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* square coordinate (subtle) */}
                      <div className="absolute bottom-1 left-1 text-[10px] text-black/40">{idxToAlgebraic(r,f)}</div>
                    </div>
                  );
                }))}
              </div>
            </div>
          </div>

          <div className="col-span-4">
            <div className="bg-white p-4 rounded-2xl shadow">
              <h2 className="font-semibold mb-2">Captured</h2>
              <CapturedPanel history={moveHistory} />

              <div className="mt-4 text-sm text-slate-600">
                <p>Click a piece to select it, click a highlighted square to move. Pawn promotion -> Queen (automatic).</p>
                <p className="mt-2">Note: this demo uses a simplified ruleset (no castling / en passant / check detection) but includes move and capture animations.</p>
              </div>
            </div>

            <div className="mt-4 bg-white p-4 rounded-2xl shadow">
              <h2 className="font-semibold mb-2">Move History</h2>
              <ol className="text-sm max-h-48 overflow-auto">
                {moveHistory.map((m,i)=>{
                  const from = idxToAlgebraic(m.from[0], m.from[1]);
                  const to = idxToAlgebraic(m.to[0], m.to[1]);
                  return <li key={i} className="mb-1">{i+1}. {m.mover.pokemon.name} {from} → {to} {m.captured? `(captured ${m.captured.pokemon.name})` : ''}</li>;
                })}
              </ol>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function CapturedPanel({history}){
  const captured = history.filter(h=>h.captured).map(h=> ({...h.captured, by: h.mover}));
  return (
    <div className="flex gap-2 flex-wrap">
      {captured.length === 0 && <div className="text-sm text-slate-400">No captures yet.</div>}
      {captured.map((c,i)=> (
        <motion.div key={i} initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0}} className="px-2 py-1 rounded-md bg-rose-50 border">
          <div className="text-sm font-medium">{c.pokemon.emoji} {c.pokemon.name}</div>
          <div className="text-[11px] text-slate-500">by {c.by.pokemon.name}</div>
        </motion.div>
      ))}
    </div>
  );
}
