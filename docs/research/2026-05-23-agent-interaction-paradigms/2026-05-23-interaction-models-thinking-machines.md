# Interaction Models: A Scalable Approach to Human-AI Collaboration

- **Source**: Thinking Machines Lab (Mira Murati)
- **Date**: 2026-05-11
- **URL**: https://thinkingmachines.ai/blog/interaction-models/
- **Type**: Blog + Model Release (no arXiv PDF)

## Core Thesis

Interactivity should scale alongside intelligence. Current AI models treat
interaction as scaffolding (external VAD, dialog managers); TML argues it must
be an architectural property of the model itself.

> "The interface has no room for them" — existing models force humans out of
> the loop not because work doesn't need them, but because the interaction
> channel is too narrow.

## Architecture: Time-Aligned Micro-Turns

- **200ms micro-turn chunks** replace traditional turn-based interaction
- Multi-stream: continuous interleaved audio + video + text I/O
- **Encoder-free early fusion**: audio (dMel spectrograms), video (40x40
  patches + hMLP), text — all trained jointly from scratch
- Inference: streaming sessions append 200ms chunks to persistent GPU memory
  sequences (contributed upstream to SGLang)
- **Async delegation**: tasks exceeding instant capacity are delegated to a
  background model while the interaction model maintains conversational presence

## Model: TML-Interaction-Small

| Spec | Value |
|------|-------|
| Total params | 276B (MoE) |
| Active at inference | 12B |
| Turn-taking latency | 0.40s (vs Gemini 0.57s, GPT Realtime 1.18s) |
| FD-bench v1.5 (interaction quality) | 77.8 (best competitor: 54.3) |
| Audio MultiChallenge APR | 43.4% |

## Novel Capabilities (no competitor scores meaningfully)

| Metric | TML | Best competitor |
|--------|-----|-----------------|
| TimeSpeak (time-aware initiation) | 64.7% | 4.3% |
| CueSpeak (verbal cue response) | 81.7% | 2.9% |
| RepCount-A (visual counting) | 35.4% | 1.3% |
| ProactiveVideoQA | 33.5 PAUC | 25.0 baseline |
| Charades (action localization) | 32.4 mIoU | 0% |

## Unlocked Interaction Modes

1. Seamless dialog management without external components
2. Verbal/visual interjections triggered by context, not turn completion
3. Simultaneous speech (e.g., live translation)
4. Direct elapsed-time perception
5. Tool calls + UI generation woven into ongoing conversation

## Limitations

- Long session context accumulation
- Requires reliable low-latency connectivity
- Larger pretrained models still too slow for real-time serving
- Background agent capability needs development

## Relevance to Cat Cafe

The "interactivity as architectural property" thesis resonates with our
multi-modal cat collaboration: interaction quality shouldn't depend on a
post-processing layer. The 200ms micro-turn + async delegation pattern maps
to a potential "fast routing reflex + deep reasoning background" split.

## Citation

```bibtex
@article{thinkingmachines2026interactionmodels,
  author = {Thinking Machines Lab},
  title = {Interaction Models: A Scalable Approach to Human-AI Collaboration},
  journal = {Thinking Machines Lab: Connectionism},
  year = {2026},
  month = {May},
  doi = {10.64434/tml.20260511}
}
```
