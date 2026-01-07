import { FastifyRequest, FastifyReply } from 'fastify';
import * as path from 'path';
import { LivePreviewShopify } from '@contentstack/shopify-live-preview-sdk';

interface SyncGithubRepoRequestBody {
  authtoken: string;
  repoName: string;
  branch?: string; // Optional branch parameter
}

export const syncGithubRepoHandler = async (request: FastifyRequest<{ Body: SyncGithubRepoRequestBody }>, reply: FastifyReply) => {
  try {
    const { authtoken, repoName, branch } = request.body;
    
    let owner: string | undefined;
    let repo: string | undefined;

    if (typeof repoName === 'string' && repoName.length > 0) {
      const slashIndex = repoName.indexOf('/');
      if (slashIndex > 0 && slashIndex < repoName.length - 1) {
        owner = repoName.substring(0, slashIndex);
        repo = repoName.substring(slashIndex + 1);
      }
    }

    if (!owner || !repo) {
      reply.status(400);
      return { error: 'Invalid repository name format. Expected format: owner/repo' };
    }
    
    // Use the pre-built views directory included in the deployment
    // This ensures persistence across serverless invocations
    const viewsPath = path.join(process.cwd(), 'views');
    
    console.log(`Using views directory: ${viewsPath} (cwd: ${process.cwd()})`);
    
    try {
      // Pass branch parameter if provided
      const cloneConfig = { auth: authtoken, owner, repo, ...(branch && { branch }) };
      await LivePreviewShopify.cloneRepository(cloneConfig, viewsPath);
      
      const branchInfo = branch ? ` (branch: ${branch})` : ' (default branch)';
      console.log(`Successfully initiated cloning of ${owner}/${repo}${branchInfo} into ${viewsPath} via utility function.`);
      return {
        success: true,
        message: `Repository ${owner}/${repo}${branchInfo} successfully cloned into ${viewsPath}`
      };
    } catch (cloneError) {
      const branchInfo = branch ? ` (branch: ${branch})` : ' (default branch)';
      console.error(`Failed to clone repository ${owner}/${repo}${branchInfo} using utility function:`, cloneError);
      reply.status(500); 
      return {
        error: `Failed to clone repository: ${cloneError instanceof Error ? cloneError.message : 'Unknown error'}`
      };
    }

  } catch (error) {
    request.log.error('Outer error in syncGithubRepoHandler: %s', error instanceof Error ? error.message : String(error));
    reply.status(500);
    return {
      error: 'Failed to process sync request'
    };
  }
}; 