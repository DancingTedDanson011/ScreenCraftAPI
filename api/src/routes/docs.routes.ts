import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

/**
 * Documentation Routes Plugin
 * Serves OpenAPI specification and documentation
 */
export async function docsRoutes(
  fastify: FastifyInstance,
  opts: FastifyPluginOptions
): Promise<void> {
  // Get OpenAPI Specification as JSON
  fastify.get('/openapi.json', {
    schema: {
      description: 'Get OpenAPI specification in JSON format',
      tags: ['documentation'],
      response: {
        200: {
          description: 'OpenAPI specification',
          type: 'object',
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Read the YAML file
      const yamlPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
      const yamlContent = await fs.readFile(yamlPath, 'utf8');

      // Parse YAML to JSON
      const openapiSpec = yaml.load(yamlContent);

      reply.type('application/json').send(openapiSpec);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: {
          code: 'OPENAPI_LOAD_ERROR',
          message: 'Failed to load OpenAPI specification',
        },
      });
    }
  });

  // Get OpenAPI Specification as YAML
  fastify.get('/openapi.yaml', {
    schema: {
      description: 'Get OpenAPI specification in YAML format',
      tags: ['documentation'],
      response: {
        200: {
          description: 'OpenAPI specification',
          type: 'string',
        },
      },
    },
  }, async (request, reply) => {
    try {
      const yamlPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
      const yamlContent = await fs.readFile(yamlPath, 'utf8');

      reply.type('application/yaml').send(yamlContent);
    } catch (error) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: {
          code: 'OPENAPI_LOAD_ERROR',
          message: 'Failed to load OpenAPI specification',
        },
      });
    }
  });

  // Redirect /docs/openapi.json to /openapi.json for convenience
  fastify.get('/docs/openapi.json', async (request, reply) => {
    reply.redirect('/openapi.json');
  });

  fastify.get('/docs/openapi.yaml', async (request, reply) => {
    reply.redirect('/openapi.yaml');
  });
}

export default docsRoutes;
