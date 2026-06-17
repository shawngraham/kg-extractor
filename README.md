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

- A gui: `npm run dev`
- A tui: `npm run tui`
- A cli for batch processing: `npm run batch`

Change the schemaPrompt.ts as appropriate for the task. Two are provided, one for archaeological secondary literature, one for antiquities trade literature.

Using llama.cpp / llamabarn for local models, change env, eg:

```
LOCAL_API_HOST=http://localhost:2276
LOCAL_API_KEY=sk-no-key-required

# Select one of your active model IDs:
#LOCAL_API_MODEL=gemma-3-27b
LOCAL_API_MODEL=unsloth/Qwen3.5-122B-A10B-GGUF:Q8_0
# Or: LOCAL_API_MODEL=ggml-org/Qwen3-VL-30B-A3B-Instruct-Q8_0-GGUF:Q8_0
# Or: LOCAL_API_MODEL=gemma-3-27b```

and swap in the appropriate tui/batch scripts.
