# Battle simulator (runs the real TS battle code)

    npx esbuild ../src/game.ts --bundle --format=cjs --platform=node --loader:.png=dataurl --outfile=/tmp/game.cjs
    # edit run path in battle-sim.cjs if needed, then:
    node battle-sim.cjs <regionFrom> <regionTo> <trials>
