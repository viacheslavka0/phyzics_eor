/**
 * Stage components for EORA learning flow.
 *
 * Each stage component is now isolated, making it easier to:
 * - Test individual learning steps
 * - Optimize re-renders
 * - Maintain complex UI logic
 * - Add accessibility features
 */

// Example imports (to be filled as components are extracted)
// export { StageComprehension } from "./StageComprehension";
// export { StageTypicalTask } from "./StageTypicalTask";
// export { StageTaskPreview } from "./StageTaskPreview";
// export { StageLearningPathChoice } from "./StageLearningPathChoice";
// export { StageTaskList } from "./StageTaskList";
// export { StageDifficultyAssessment } from "./StageDifficultyAssessment";
// export { StageSolving } from "./StageSolving";
// export { StageMethodComposition } from "./StageMethodComposition";
// export { StageStepByStep } from "./StageStepByStep";
// export { StageCompleted } from "./StageCompleted";

/**
 * Migration guide:
 *
 * 1. Extract each Stage function from App.jsx (6600 lines → 10 components)
 * 2. Move hooks (useState, useContext, etc.) to component level
 * 3. Add React.memo() to prevent unnecessary re-renders
 * 4. Add accessibility attributes (role, aria-*, aria-labelledby)
 * 5. Extract reusable sub-components (buttons, forms, cards)
 * 6. Use utils/api.js for all API calls
 *
 * Example pattern (see StageComprehensionExample.jsx):
 *
 * export function StageComprehension({ session, ks, onSessionUpdate, onBack }) {
 *   const [mappings, setMappings] = useState({});
 *   const [errors, setErrors] = useState(null);
 *
 *   const handleCheck = async () => {
 *     try {
 *       const data = await apiCall(`/api/ks/${ks.id}/check/`, {
 *         method: "POST",
 *         body: JSON.stringify({ mappings, cloze_answers: [] }),
 *       });
 *       onSessionUpdate(data);
 *     } catch (err) {
 *       setErrors(err.message);
 *     }
 *   };
 *
 *   return (
 *     <section role="main" aria-labelledby="stage-title">
 *       <h1 id="stage-title">Осмысление системы знаний</h1>
 *       {/* Content */}
 *     </section>
 *   );
 * }
 *
 * export default React.memo(StageComprehension);
 */
