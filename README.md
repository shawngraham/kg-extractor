# kg-extractor
using carleton rcs local models -> knowledge graph 

makes four passes per input text. Once to reify entities, second to sort out predicates, third to lint and make sure all predicates are ok, fourth to make the final graph. Outputs reports and csv for auditing.

make a .env file and set configuration:

```
LOCAL_API_HOST="https://rcsllm.carleton.ca/rcsapi"
LOCAL_API_KEY="YOUR_CARLETON_API_BEARER_TOKEN"
LOCAL_API_MODEL="qwen3.5:122b"
```

then,

`npm install`

A gui: `npm run dev`
A tui: `npm run tui`
A cli for batch processing: `npm run batch`

Change the schemaPrompt.ts as appropriate for the task. Two are provided, one for archaeological secondary literature, one for antiquities trade literature.

