import {HYBRID_VERSION} from "./hybrid-engine";
import {sameGoalMapping} from "./hybrid-mapping";
import type {Link} from "./tracker";
/** Calendar age alone does not invalidate a confirmed plan. */
export function planNeedsReview(saved:{input_revision:string;engine_version:string;result:{links:Link[]}},sourceRevision:string,links:Link[]){
 return saved.input_revision!==sourceRevision||saved.engine_version!==HYBRID_VERSION||!sameGoalMapping(saved.result.links,links);
}
